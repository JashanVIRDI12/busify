-- ===========================================================================
-- Busify AI — 0008: scope DRIVER access for the driver portal
--
-- Until now every tenant table's SELECT policy was "any member of the org",
-- so a DRIVER could read the whole company over the API — customers, quotes,
-- every trip. The driver portal only ever shows a driver their own work, and
-- RLS is the boundary here, not the application.
--
-- This migration:
--   * adds helpers to identify a driver membership and a non-driver membership
--   * rewrites "<table>: members read" to exclude drivers on the tables a
--     driver has no business reading in full
--   * adds narrow, driver-scoped SELECT policies for the tables the portal
--     needs: their assigned trips and everything hanging off them, plus their
--     own driver record, documents and availability
--
-- NOTE: the driver policies here filter trip_assignments with a subquery on
-- trip_assignments, which Postgres rejects as infinite recursion. Migration
-- 0009 replaces them with SECURITY DEFINER helpers. It is kept as a separate
-- migration because 0008 had already been applied when the bug was found.
--
-- Write access for drivers lands in migration 0010.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- The driver record linked to a login. One per person in practice
-- (drivers has unique (organization_id, user_id)); LIMIT 1 keeps it a scalar.
create or replace function app.current_driver_id(uid uuid default auth.uid())
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select d.id from public.drivers d where d.user_id = uid limit 1;
$$;

-- True when this person's membership in `org` is the DRIVER role.
create or replace function app.is_org_driver(org uuid, uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = org and m.user_id = uid and m.role = 'DRIVER'
  );
$$;

-- True when this person is a member of `org` in any role other than DRIVER —
-- i.e. someone entitled to read the organization's records in full. One call
-- rather than is_org_member() AND NOT is_org_driver().
create or replace function app.is_non_driver_member(org uuid, uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = org and m.user_id = uid and m.role <> 'DRIVER'
  );
$$;

grant execute on function
  app.current_driver_id(uuid),
  app.is_org_driver(uuid, uuid),
  app.is_non_driver_member(uuid, uuid)
to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Narrow "members read" to non-drivers on the tables a driver must not read
-- wholesale. Every INSERT/UPDATE/DELETE policy and the accountant carve-outs
-- are left exactly as migration 0004 created them.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  narrowed text[] := array[
    'customers',
    'vehicle_types',
    'vehicle_maintenance',
    'trip_requests',
    'quotes',
    'quote_items',
    'bookings',
    'booking_passengers',
    'trip_passengers',
    'drivers',
    'driver_documents',
    'driver_availability',
    'trips',
    'trip_assignments'
  ];
begin
  foreach t in array narrowed loop
    execute format('drop policy %I on public.%I', t || ': members read', t);
    execute format(
      'create policy %I on public.%I for select to authenticated '
      || 'using (app.is_non_driver_member(organization_id, (select auth.uid())))',
      t || ': members read', t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Driver-scoped SELECT policies. Superseded by migration 0009 — see the note
-- at the top of this file.
-- ---------------------------------------------------------------------------
create policy "trips: assigned driver reads"
  on public.trips for select to authenticated
  using (
    id in (
      select ta.trip_id from public.trip_assignments ta
      where ta.driver_id = (select app.current_driver_id())
    )
  );

create policy "trip_assignments: assigned driver reads"
  on public.trip_assignments for select to authenticated
  using (
    trip_id in (
      select ta.trip_id from public.trip_assignments ta
      where ta.driver_id = (select app.current_driver_id())
    )
  );

create policy "customers: assigned driver reads"
  on public.customers for select to authenticated
  using (
    id in (
      select tr.customer_id from public.trips tr
      where tr.customer_id is not null
        and tr.id in (
          select ta.trip_id from public.trip_assignments ta
          where ta.driver_id = (select app.current_driver_id())
        )
    )
  );

create policy "trip_passengers: assigned driver reads"
  on public.trip_passengers for select to authenticated
  using (
    trip_id in (
      select ta.trip_id from public.trip_assignments ta
      where ta.driver_id = (select app.current_driver_id())
    )
  );

create policy "drivers: self and co-driver read"
  on public.drivers for select to authenticated
  using (
    id = (select app.current_driver_id())
    or id in (
      select ta.driver_id from public.trip_assignments ta
      where ta.driver_id is not null
        and ta.trip_id in (
          select mine.trip_id from public.trip_assignments mine
          where mine.driver_id = (select app.current_driver_id())
        )
    )
  );

create policy "driver_documents: self reads"
  on public.driver_documents for select to authenticated
  using (driver_id = (select app.current_driver_id()));

create policy "driver_availability: self reads"
  on public.driver_availability for select to authenticated
  using (driver_id = (select app.current_driver_id()));
