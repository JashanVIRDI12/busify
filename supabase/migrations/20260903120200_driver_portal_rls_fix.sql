-- ===========================================================================
-- Busify AI — 0009: fix recursive driver RLS policies
--
-- The driver SELECT policies added in 0008 filtered trip_assignments with a
-- subquery on trip_assignments, which Postgres rejects as infinite recursion
-- ("infinite recursion detected in policy for relation trip_assignments").
--
-- The fix is the same pattern the rest of the schema uses: read the joining
-- rows inside SECURITY DEFINER helpers so the policy never re-enters its own
-- table. This migration is idempotent — on a database that already has 0008 in
-- its corrected form it is a no-op.
-- ===========================================================================

create or replace function app.driver_trip_ids(uid uuid default auth.uid())
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select ta.trip_id
  from public.trip_assignments ta
  join public.drivers d on d.id = ta.driver_id
  where d.user_id = uid;
$$;

create or replace function app.driver_customer_ids(uid uuid default auth.uid())
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select distinct t.customer_id
  from public.trips t
  where t.customer_id is not null
    and t.id in (select app.driver_trip_ids(uid));
$$;

create or replace function app.driver_peer_ids(uid uuid default auth.uid())
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select distinct ta.driver_id
  from public.trip_assignments ta
  where ta.driver_id is not null
    and ta.trip_id in (select app.driver_trip_ids(uid));
$$;

grant execute on function
  app.driver_trip_ids(uuid),
  app.driver_customer_ids(uuid),
  app.driver_peer_ids(uuid)
to authenticated, service_role;

drop policy if exists "trips: assigned driver reads" on public.trips;
create policy "trips: assigned driver reads"
  on public.trips for select to authenticated
  using (id in (select app.driver_trip_ids()));

drop policy if exists "trip_assignments: assigned driver reads" on public.trip_assignments;
create policy "trip_assignments: assigned driver reads"
  on public.trip_assignments for select to authenticated
  using (trip_id in (select app.driver_trip_ids()));

drop policy if exists "customers: assigned driver reads" on public.customers;
create policy "customers: assigned driver reads"
  on public.customers for select to authenticated
  using (id in (select app.driver_customer_ids()));

drop policy if exists "trip_passengers: assigned driver reads" on public.trip_passengers;
create policy "trip_passengers: assigned driver reads"
  on public.trip_passengers for select to authenticated
  using (trip_id in (select app.driver_trip_ids()));

drop policy if exists "drivers: self and co-driver read" on public.drivers;
create policy "drivers: self and co-driver read"
  on public.drivers for select to authenticated
  using (
    id = (select app.current_driver_id())
    or id in (select app.driver_peer_ids())
  );
