-- ===========================================================================
-- Busify — 0016: link a reservation to the trip tab that produced it,
--                and backfill what conversion used to throw away
--
-- `trips.quote_id` says which quote a reservation came from, but a quote holds
-- several trip tabs and nothing recorded *which* one. That was tolerable while
-- conversion only copied text, and stopped being tolerable the moment
-- reservations started carrying figures the quote had already worked out:
-- there was no way to go back and fetch them for a reservation created before
-- those columns existed.
--
-- So: record the link, use it to backfill, and keep it for every future
-- conversion.
--
-- Pairing older rows has to be positional, because the fact that would make it
-- exact is the one being added. Reservations are numbered as siblings of their
-- quote — 10009, 10009-2, 10009-3 — in the order the tabs were converted, so
-- nth reservation matches nth tab. `on delete set null`, because deleting a
-- quote must never take a sold job with it.
-- ===========================================================================

alter table public.trips
  add column if not exists quote_trip_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'trips_quote_trip_fk'
  ) then
    alter table public.trips
      add constraint trips_quote_trip_fk
      foreign key (organization_id, quote_trip_id)
      references public.quote_trips (organization_id, id)
      on delete set null;
  end if;
end $$;

create index if not exists trips_quote_trip_idx
  on public.trips (quote_trip_id);

-- ---------------------------------------------------------------------------
-- 1. Pair each reservation with its trip tab.
-- ---------------------------------------------------------------------------
with ordered_trips as (
  select
    id,
    organization_id,
    quote_id,
    row_number() over (
      partition by quote_id
      order by reference nulls last, created_at
    ) as seq
  from public.trips
  where quote_id is not null
    and quote_trip_id is null
),
ordered_tabs as (
  select
    id,
    organization_id,
    quote_id,
    row_number() over (
      partition by quote_id
      order by position, created_at
    ) as seq
  from public.quote_trips
)
update public.trips t
set quote_trip_id = tab.id
from ordered_trips ot
join ordered_tabs tab
  on tab.quote_id = ot.quote_id
 and tab.organization_id = ot.organization_id
 and tab.seq = ot.seq
where t.id = ot.id;

-- ---------------------------------------------------------------------------
-- 2. Distance and duty time, as the itinerary measured them.
--    Only where nothing has been recorded, so a hand-corrected figure stands.
-- ---------------------------------------------------------------------------
update public.trips t
set planned_miles   = coalesce(qt.total_miles, 0),
    planned_minutes = coalesce(qt.estimated_minutes, 0)
from public.quote_trips qt
where qt.id = t.quote_trip_id
  and t.planned_miles = 0
  and t.planned_minutes = 0;

-- ---------------------------------------------------------------------------
-- 3. Coordinates, from the stops the operator picked out of the typeahead.
-- ---------------------------------------------------------------------------
with first_stop as (
  select distinct on (quote_trip_id)
    quote_trip_id, position, address, latitude, longitude
  from public.quote_trip_stops
  order by quote_trip_id, position
)
update public.trips t
set pickup_lat = f.latitude,
    pickup_lng = f.longitude
from first_stop f
where f.quote_trip_id = t.quote_trip_id
  and t.pickup_lat is null
  and f.latitude is not null;

-- The destination is not the last stop: on a round trip that is back where the
-- group started. It is the first stop that is somewhere *else* — the same rule
-- the conversion applies, kept identical here so backfilled rows and newly
-- converted ones cannot disagree.
with first_stop as (
  select distinct on (quote_trip_id)
    quote_trip_id, position, address
  from public.quote_trip_stops
  order by quote_trip_id, position
),
destination as (
  select distinct on (s.quote_trip_id)
    s.quote_trip_id, s.latitude, s.longitude
  from public.quote_trip_stops s
  join first_stop f on f.quote_trip_id = s.quote_trip_id
  where s.position > f.position
    and coalesce(s.address, '') is distinct from coalesce(f.address, '')
  order by s.quote_trip_id, s.position
)
update public.trips t
set destination_lat = d.latitude,
    destination_lng = d.longitude
from destination d
where d.quote_trip_id = t.quote_trip_id
  and t.destination_lat is null
  and d.latitude is not null;

comment on column public.trips.quote_trip_id is
  'The quote trip tab this reservation was converted from, when it had one.';
