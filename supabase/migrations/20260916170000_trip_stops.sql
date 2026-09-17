-- ===========================================================================
-- Busify — 0017: the stops a reservation actually makes
--
-- A reservation stored its route as two strings, `pickup_location` and
-- `destination`, plus four loose timestamps. That is enough to sort a board by
-- and nothing else: a charter that collects a school, runs to a venue, waits
-- six hours and brings everyone home is four stops, and it was being recorded
-- as two ends with the middle thrown away.
--
-- The quote already holds all of it. `quote_trip_stops` has every stop, its
-- address, its coordinates and its times, and conversion was dropping
-- everything between the first and the last.
--
-- Times are stored as instants rather than as a local date plus a local time.
-- On the quote they are wall-clock values the operator is still editing; once
-- sold, a stop happens at a moment, and a dispatch board comparing two trips
-- across a daylight-saving boundary needs them comparable.
--
-- Three of them, because a stop the coach returns to has three: it arrives and
-- drops the group, it boards them again hours later, and then it leaves.
-- ===========================================================================

create type public.trip_stop_kind as enum (
  'GARAGE_OUT', 'PICKUP', 'STOP', 'DROPOFF', 'GARAGE_IN'
);

create table public.trip_stops (
  id              uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  trip_id         uuid not null,
  position        int not null default 0,
  kind            public.trip_stop_kind not null default 'STOP',
  /** The garage's name, or what the operator called this stop. */
  label           text,
  address         text,
  latitude        numeric(9, 6),
  longitude       numeric(9, 6),
  /** Wheels stop: the arrival, the dropoff, or the return to the yard. */
  arrive_at       timestamptz,
  /** Passengers board for the onward leg. Null when nobody re-boards here. */
  board_at        timestamptz,
  /** Wheels roll. */
  depart_at       timestamptz,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, trip_id)
    references public.trips (organization_id, id) on delete cascade
);

create index trip_stops_org_idx  on public.trip_stops (organization_id);
create index trip_stops_trip_idx on public.trip_stops (trip_id, position);

create trigger trip_stops_set_updated_at
  before update on public.trip_stops
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS, matching every other tenant table: members read, staff write, managers
-- delete, and accountants write because they own the money side of a job.
-- ---------------------------------------------------------------------------
alter table public.trip_stops enable row level security;

create policy "trip_stops: members read"
  on public.trip_stops for select to authenticated
  using (app.is_org_member(organization_id, (select auth.uid())));

create policy "trip_stops: staff insert"
  on public.trip_stops for insert to authenticated
  with check (app.can_write(organization_id, (select auth.uid())));

create policy "trip_stops: staff update"
  on public.trip_stops for update to authenticated
  using (app.can_write(organization_id, (select auth.uid())))
  with check (app.can_write(organization_id, (select auth.uid())));

create policy "trip_stops: managers delete"
  on public.trip_stops for delete to authenticated
  using (app.can_manage(organization_id, (select auth.uid())));

-- ---------------------------------------------------------------------------
-- Backfill from the quote, for every reservation converted before today.
--
-- `quote_trip_id` (migration 0016) is what makes this possible. Times are
-- combined from the quote's local date and time using the organization's zone,
-- which is the same conversion the application does.
-- ---------------------------------------------------------------------------
insert into public.trip_stops (
  organization_id, trip_id, position, kind, label, address,
  latitude, longitude, arrive_at, depart_at
)
select
  t.organization_id,
  t.id,
  s.position,
  case
    when s.kind = 'PICKUP'  then 'PICKUP'::public.trip_stop_kind
    when s.kind = 'DROPOFF' then 'DROPOFF'::public.trip_stop_kind
    else 'STOP'::public.trip_stop_kind
  end,
  s.label,
  s.address,
  s.latitude,
  s.longitude,
  -- Spot time is when the coach is standing there; departure is when it leaves.
  case
    when s.stop_date is null then null
    else (s.stop_date + coalesce(s.spot_time, s.stop_time, '00:00'::time))
           at time zone coalesce(o.timezone, 'UTC')
  end,
  case
    when s.stop_date is null then null
    else (s.stop_date + coalesce(s.stop_time, '00:00'::time))
           at time zone coalesce(o.timezone, 'UTC')
  end
from public.trips t
join public.quote_trip_stops s on s.quote_trip_id = t.quote_trip_id
join public.organizations o on o.id = t.organization_id
where t.quote_trip_id is not null
  and not exists (
    select 1 from public.trip_stops existing where existing.trip_id = t.id
  );

-- The yard at either end, which is not a quote stop but a garage on the trip.
insert into public.trip_stops (
  organization_id, trip_id, position, kind, label, arrive_at, depart_at
)
select
  t.organization_id, t.id, -1, 'GARAGE_OUT'::public.trip_stop_kind,
  g.name, t.garage_arrival_at, t.garage_arrival_at
from public.trips t
join public.garages g on g.id = t.garage_id
where t.garage_id is not null
  and not exists (
    select 1 from public.trip_stops s
    where s.trip_id = t.id and s.kind = 'GARAGE_OUT'
  );

insert into public.trip_stops (
  organization_id, trip_id, position, kind, label, arrive_at
)
select
  t.organization_id, t.id, 9999, 'GARAGE_IN'::public.trip_stop_kind,
  g.name, t.return_at
from public.trips t
join public.garages g on g.id = t.garage_id
where t.garage_id is not null
  and t.return_at is not null
  and not exists (
    select 1 from public.trip_stops s
    where s.trip_id = t.id and s.kind = 'GARAGE_IN'
  );

comment on table public.trip_stops is
  'Every stop a sold reservation makes, in order, with its planned clock.';
