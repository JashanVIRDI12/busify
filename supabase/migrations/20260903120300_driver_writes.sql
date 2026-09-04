-- ===========================================================================
-- Busify AI — 0010: driver write access
--
-- The portal lets a driver do two things beyond reading: move their trip
-- through its status ("on my way" → "completed") and block off time they are
-- not available. Both are scoped to the driver's own records in the database,
-- not just the UI.
--
-- Trip updates are row-scoped by policy and column-scoped by a trigger, since
-- a policy cannot say "only the status column".
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Trips: an assigned driver may update their own trip...
-- ---------------------------------------------------------------------------
create policy "trips: assigned driver updates"
  on public.trips for update to authenticated
  using (id in (select app.driver_trip_ids()))
  with check (id in (select app.driver_trip_ids()));

-- ...but only the status column. Anything else is dispatch's to change.
create or replace function app.guard_driver_trip_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if app.is_org_driver(new.organization_id) then
    if new.organization_id is distinct from old.organization_id
      or new.trip_request_id is distinct from old.trip_request_id
      or new.customer_id   is distinct from old.customer_id
      or new.pickup_location is distinct from old.pickup_location
      or new.destination   is distinct from old.destination
      or new.departure_at  is distinct from old.departure_at
      or new.return_at     is distinct from old.return_at
      or new.passenger_count is distinct from old.passenger_count
      or new.notes         is distinct from old.notes
    then
      raise exception 'Drivers can only change a trip''s status'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger trips_guard_driver_update
  before update on public.trips
  for each row execute function app.guard_driver_trip_update();

-- ---------------------------------------------------------------------------
-- Driver availability: a driver manages their own windows. OR-ed with the
-- staff/manager policies from 0004, so dispatch is unaffected.
-- ---------------------------------------------------------------------------
create policy "driver_availability: self inserts"
  on public.driver_availability for insert to authenticated
  with check (driver_id = (select app.current_driver_id()));

create policy "driver_availability: self updates"
  on public.driver_availability for update to authenticated
  using (driver_id = (select app.current_driver_id()))
  with check (driver_id = (select app.current_driver_id()));

create policy "driver_availability: self deletes"
  on public.driver_availability for delete to authenticated
  using (driver_id = (select app.current_driver_id()));
