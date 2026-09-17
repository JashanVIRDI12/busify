-- ===========================================================================
-- Busify — 0014: coordinates on a reservation
--
-- A reservation stores where it goes as free text, which is all a dispatcher
-- needs to read but not enough to draw. Plotting a job on a map therefore
-- meant geocoding two addresses on every render — a paid lookup, twice, for a
-- picture that never changes once the trip is sold.
--
-- The quote already knows. Its stops carry coordinates from the moment the
-- operator picked an address out of the typeahead, and the conversion simply
-- threw them away. These columns are where they land instead.
--
-- Nullable on purpose: a trip whose addresses were typed rather than picked
-- has no coordinates to carry, and the map says so rather than guessing.
-- ===========================================================================

alter table public.trips
  add column if not exists pickup_lat numeric(9, 6),
  add column if not exists pickup_lng numeric(9, 6),
  add column if not exists destination_lat numeric(9, 6),
  add column if not exists destination_lng numeric(9, 6);

comment on column public.trips.pickup_lat is
  'Latitude of pickup_location, carried from the quote stop that produced it.';
comment on column public.trips.destination_lat is
  'Latitude of destination, carried from the quote stop that produced it.';
