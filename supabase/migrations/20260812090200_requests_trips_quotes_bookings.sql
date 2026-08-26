-- ===========================================================================
-- Busify AI — 0003: trip requests, trips, quotes, bookings
--
-- Same composite-FK tenancy rule as 0002.
--
-- Lifecycle:  trip_request --(operator accepts)--> quote --> booking --> trip
-- A trip request never becomes a confirmed booking on its own.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- trip_requests
-- ---------------------------------------------------------------------------
create table public.trip_requests (
  id                   uuid primary key default extensions.gen_random_uuid(),
  organization_id      uuid not null references public.organizations(id) on delete cascade,
  customer_id          uuid,

  reference            text,

  pickup_location      text not null check (length(btrim(pickup_location)) > 0),
  pickup_address       text,

  destination          text not null check (length(btrim(destination)) > 0),
  destination_address  text,

  departure_at         timestamptz not null,
  return_at            timestamptz,

  passenger_count      int not null check (passenger_count between 1 and 5000),

  special_requirements text,

  status               public.trip_request_status not null default 'NEW',
  source               public.trip_request_source not null default 'DASHBOARD',

  -- Denormalised contact details: widget/API submissions arrive before a
  -- customer record exists.
  contact_name         text,
  contact_email        text,
  contact_phone        text,

  notes                text,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  unique (organization_id, id),
  unique (organization_id, reference),
  check (return_at is null or return_at > departure_at),
  foreign key (organization_id, customer_id)
    references public.customers (organization_id, id)
    on delete set null
);

create index trip_requests_org_status_idx    on public.trip_requests (organization_id, status);
create index trip_requests_org_departure_idx on public.trip_requests (organization_id, departure_at);
create index trip_requests_customer_idx      on public.trip_requests (customer_id);

create trigger trip_requests_set_updated_at
  before update on public.trip_requests
  for each row execute function app.set_updated_at();

create or replace function app.assign_trip_request_reference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.reference is null then
    new.reference := app.next_document_number(new.organization_id, 'TRIP_REQUEST', 'TR');
  end if;
  return new;
end;
$$;

create trigger trip_requests_assign_reference
  before insert on public.trip_requests
  for each row execute function app.assign_trip_request_reference();

-- ---------------------------------------------------------------------------
-- trips
-- ---------------------------------------------------------------------------
create table public.trips (
  id              uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  trip_request_id uuid,
  customer_id     uuid,

  pickup_location text not null check (length(btrim(pickup_location)) > 0),
  destination     text not null check (length(btrim(destination)) > 0),

  departure_at    timestamptz not null,
  return_at       timestamptz,

  passenger_count int not null check (passenger_count between 1 and 5000),

  status          public.trip_status not null default 'SCHEDULED',
  notes           text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (organization_id, id),
  check (return_at is null or return_at > departure_at),
  foreign key (organization_id, trip_request_id)
    references public.trip_requests (organization_id, id)
    on delete set null,
  foreign key (organization_id, customer_id)
    references public.customers (organization_id, id)
    on delete set null
);

create index trips_org_status_idx    on public.trips (organization_id, status);
create index trips_org_departure_idx on public.trips (organization_id, departure_at);
create index trips_customer_idx      on public.trips (customer_id);
create index trips_request_idx       on public.trips (trip_request_id);

create trigger trips_set_updated_at
  before update on public.trips
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- trip_assignments — which vehicle and driver run a trip
-- ---------------------------------------------------------------------------
create table public.trip_assignments (
  id              uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  trip_id         uuid not null,
  vehicle_id      uuid,
  driver_id       uuid,
  role            text not null default 'PRIMARY' check (role in ('PRIMARY', 'RELIEF')),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  foreign key (organization_id, trip_id)
    references public.trips (organization_id, id) on delete cascade,
  foreign key (organization_id, vehicle_id)
    references public.vehicles (organization_id, id) on delete set null,
  foreign key (organization_id, driver_id)
    references public.drivers (organization_id, id) on delete set null
);

create index trip_assignments_org_idx     on public.trip_assignments (organization_id);
create index trip_assignments_trip_idx    on public.trip_assignments (trip_id);
create index trip_assignments_vehicle_idx on public.trip_assignments (vehicle_id);
create index trip_assignments_driver_idx  on public.trip_assignments (driver_id);

create trigger trip_assignments_set_updated_at
  before update on public.trip_assignments
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- trip_passengers
-- ---------------------------------------------------------------------------
create table public.trip_passengers (
  id              uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  trip_id         uuid not null,
  full_name       text not null,
  email           text,
  phone           text,
  seat_label      text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  foreign key (organization_id, trip_id)
    references public.trips (organization_id, id) on delete cascade
);

create index trip_passengers_org_idx  on public.trip_passengers (organization_id);
create index trip_passengers_trip_idx on public.trip_passengers (trip_id);

create trigger trip_passengers_set_updated_at
  before update on public.trip_passengers
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- quotes
-- ---------------------------------------------------------------------------
create table public.quotes (
  id              uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  trip_request_id uuid,
  customer_id     uuid,

  -- Filled by a BEFORE INSERT trigger; never supplied by the client.
  quote_number    text,

  -- Totals are computed server-side by lib/pricing and persisted here.
  subtotal        numeric(12, 2) not null default 0 check (subtotal >= 0),
  tax             numeric(12, 2) not null default 0 check (tax >= 0),
  discount        numeric(12, 2) not null default 0 check (discount >= 0),
  total           numeric(12, 2) not null default 0 check (total >= 0),
  deposit_amount  numeric(12, 2) not null default 0 check (deposit_amount >= 0),
  currency        text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),

  valid_until     date,
  status          public.quote_status not null default 'DRAFT',

  -- Opaque token for the public /quote/[token] page. Never the row id.
  public_token    uuid not null default extensions.gen_random_uuid(),

  sent_at         timestamptz,
  viewed_at       timestamptz,
  responded_at    timestamptz,
  notes           text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (organization_id, id),
  unique (organization_id, quote_number),
  unique (public_token),
  foreign key (organization_id, trip_request_id)
    references public.trip_requests (organization_id, id) on delete set null,
  foreign key (organization_id, customer_id)
    references public.customers (organization_id, id) on delete set null
);

create index quotes_org_status_idx on public.quotes (organization_id, status);
create index quotes_request_idx    on public.quotes (trip_request_id);
create index quotes_customer_idx   on public.quotes (customer_id);

create trigger quotes_set_updated_at
  before update on public.quotes
  for each row execute function app.set_updated_at();

create or replace function app.assign_quote_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.quote_number is null or btrim(new.quote_number) = '' then
    new.quote_number := app.next_document_number(new.organization_id, 'QUOTE', 'Q');
  end if;
  return new;
end;
$$;

create trigger quotes_assign_number
  before insert on public.quotes
  for each row execute function app.assign_quote_number();

-- ---------------------------------------------------------------------------
-- quote_items
-- ---------------------------------------------------------------------------
create table public.quote_items (
  id              uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  quote_id        uuid not null,
  kind            public.quote_item_kind not null default 'OTHER',
  description     text not null check (length(btrim(description)) > 0),
  quantity        numeric(10, 2) not null default 1 check (quantity > 0),
  unit_price      numeric(12, 2) not null default 0,
  amount          numeric(12, 2) not null default 0,
  position        int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  foreign key (organization_id, quote_id)
    references public.quotes (organization_id, id) on delete cascade
);

create index quote_items_org_idx   on public.quote_items (organization_id);
create index quote_items_quote_idx on public.quote_items (quote_id, position);

create trigger quote_items_set_updated_at
  before update on public.quote_items
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- bookings
-- ---------------------------------------------------------------------------
create table public.bookings (
  id              uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  quote_id        uuid,
  trip_id         uuid,
  customer_id     uuid,

  booking_number  text,

  status          public.booking_status not null default 'PENDING_PAYMENT',

  total_amount    numeric(12, 2) not null default 0 check (total_amount >= 0),
  deposit_amount  numeric(12, 2) not null default 0 check (deposit_amount >= 0),
  balance_amount  numeric(12, 2) not null default 0 check (balance_amount >= 0),
  currency        text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (organization_id, id),
  unique (organization_id, booking_number),
  foreign key (organization_id, quote_id)
    references public.quotes (organization_id, id) on delete set null,
  foreign key (organization_id, trip_id)
    references public.trips (organization_id, id) on delete set null,
  foreign key (organization_id, customer_id)
    references public.customers (organization_id, id) on delete set null
);

create index bookings_org_status_idx on public.bookings (organization_id, status);
create index bookings_customer_idx   on public.bookings (customer_id);
create index bookings_trip_idx       on public.bookings (trip_id);
create index bookings_quote_idx      on public.bookings (quote_id);

create trigger bookings_set_updated_at
  before update on public.bookings
  for each row execute function app.set_updated_at();

create or replace function app.assign_booking_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.booking_number is null or btrim(new.booking_number) = '' then
    new.booking_number := app.next_document_number(new.organization_id, 'BOOKING', 'BK');
  end if;
  return new;
end;
$$;

create trigger bookings_assign_number
  before insert on public.bookings
  for each row execute function app.assign_booking_number();

-- ---------------------------------------------------------------------------
-- booking_passengers
-- ---------------------------------------------------------------------------
create table public.booking_passengers (
  id              uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  booking_id      uuid not null,
  full_name       text not null,
  email           text,
  phone           text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  foreign key (organization_id, booking_id)
    references public.bookings (organization_id, id) on delete cascade
);

create index booking_passengers_org_idx     on public.booking_passengers (organization_id);
create index booking_passengers_booking_idx on public.booking_passengers (booking_id);

create trigger booking_passengers_set_updated_at
  before update on public.booking_passengers
  for each row execute function app.set_updated_at();
