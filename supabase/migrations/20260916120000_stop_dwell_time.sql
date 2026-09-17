-- ===========================================================================
-- Busify — 0013: dwell time at a stop
--
-- How long the coach waits somewhere, which is not the same as how long it
-- took to drive there. A wedding charter is an hour of driving and six hours
-- standing at the venue; priced on drive time alone it is quoted at a sixth of
-- what it costs to run.
--
-- This is the missing input that makes duty hours computable. Spot time to
-- final garage arrival is drive time plus dwell, and that one figure decides
-- both the hourly fare and how many drivers the trip legally needs under
-- Canadian hours-of-service rules. Without it the builder has to ask the
-- operator for hours it already has the parts to work out.
--
-- Zero by default, which is exactly right for a straight point-to-point run
-- and keeps every quote written before today unchanged.
-- ===========================================================================

alter table public.quote_trip_stops
  add column if not exists dwell_minutes int not null default 0
    check (dwell_minutes >= 0);

comment on column public.quote_trip_stops.dwell_minutes is
  'Minutes the coach waits at this stop before departing for the next one. '
  'Drive time lives in leg_minutes; this is the standing time on top of it.';
