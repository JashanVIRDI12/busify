-- ===========================================================================
-- Busify — 0015: planned distance and time on a reservation
--
-- The Tracking panel compares what was planned against what actually ran. The
-- planned half was already worked out on the quote — measured against a real
-- road network when the operator built the itinerary — and then dropped at
-- conversion, leaving the reservation with no distance at all.
--
-- Carried rather than recomputed. Re-routing a sold trip on every page view
-- would be a paid lookup to re-derive a number that was settled when the
-- customer agreed to it, and a road that changes next year must not silently
-- restate what was sold.
-- ===========================================================================

alter table public.trips
  add column if not exists planned_miles numeric(10, 2) not null default 0
    check (planned_miles >= 0),
  add column if not exists planned_minutes int not null default 0
    check (planned_minutes >= 0);

comment on column public.trips.planned_miles is
  'Distance the quote measured for this trip, in kilometres despite the name.';
comment on column public.trips.planned_minutes is
  'Duty minutes the quote worked out: driving, waiting and the dead legs.';
