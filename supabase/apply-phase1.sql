-- ===========================================================================
-- Busify AI - Phase 1 schema: all migrations concatenated, in order.
--
-- Paste this whole file into the Supabase SQL Editor and Run it once.
-- Generated from supabase/migrations/ - edit the source files, not this one.
-- Not picked up by 'supabase db push', which reads migrations/ only.
-- ===========================================================================

-- ######################## 20260812090000_init_core.sql ########################

-- ===========================================================================
-- Busify AI — 0001 core: extensions, private schema, enums, shared helpers
-- ===========================================================================

create extension if not exists "pgcrypto" with schema extensions;

-- Private schema for security-definer helpers. Deliberately NOT added to
-- PostgREST's exposed schemas, so none of this is reachable over the API.
create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to authenticated, anon, service_role;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.org_role as enum (
  'OWNER', 'ADMIN', 'DISPATCHER', 'DRIVER', 'ACCOUNTANT', 'STAFF'
);

create type public.vehicle_status as enum (
  'AVAILABLE', 'ASSIGNED', 'IN_TRIP', 'MAINTENANCE', 'INACTIVE'
);

create type public.driver_status as enum (
  'ACTIVE', 'OFF_DUTY', 'ON_TRIP', 'ON_LEAVE', 'INACTIVE'
);

create type public.driver_document_type as enum (
  'LICENSE', 'MEDICAL_CERTIFICATE', 'BACKGROUND_CHECK', 'TRAINING', 'OTHER'
);

create type public.trip_request_status as enum (
  'NEW', 'REVIEWING', 'NEEDS_INFORMATION', 'QUOTED', 'ACCEPTED', 'DECLINED', 'EXPIRED'
);

create type public.trip_request_source as enum (
  'DASHBOARD', 'WEBSITE_WIDGET', 'HOSTED_PAGE', 'API', 'AI'
);

create type public.trip_status as enum (
  'SCHEDULED', 'CONFIRMED', 'DISPATCHED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'
);

create type public.quote_status as enum (
  'DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'DECLINED', 'EXPIRED'
);

create type public.quote_item_kind as enum (
  'VEHICLE', 'DRIVER', 'FUEL', 'MILEAGE', 'TOLLS', 'ADDITIONAL_SERVICE', 'OTHER'
);

create type public.booking_status as enum (
  'PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED', 'COMPLETED'
);

create type public.maintenance_status as enum (
  'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'
);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function app.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles — mirrors auth.users so the app can display teammate names without
-- ever querying the auth schema from the client.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function app.set_updated_at();

create or replace function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Aliased so ON CONFLICT can refer to the existing row unambiguously.
  insert into public.profiles as p (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', '')
    ),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do update
    set email     = excluded.email,
        full_name = coalesce(excluded.full_name, p.full_name);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------
create table public.organizations (
  id          uuid primary key default extensions.gen_random_uuid(),
  name        text not null check (length(btrim(name)) between 2 and 120),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  logo_url    text,
  phone       text,
  email       text,
  address     text,
  city        text,
  state       text,
  country     text not null default 'IN',
  timezone    text not null default 'Asia/Kolkata',
  currency    text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- organization_members
-- ---------------------------------------------------------------------------
create table public.organization_members (
  id              uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            public.org_role not null default 'STAFF',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index organization_members_user_id_idx on public.organization_members (user_id);
create index organization_members_org_id_idx  on public.organization_members (organization_id);

create trigger organization_members_set_updated_at
  before update on public.organization_members
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Tenancy helpers.
--
-- These are SECURITY DEFINER so RLS policies on organization_members can call
-- them without recursing into their own policy. search_path is pinned to ''
-- so a caller cannot shadow the tables being read.
-- ---------------------------------------------------------------------------
create or replace function app.user_organization_ids(uid uuid default auth.uid())
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.organization_id
  from public.organization_members m
  where m.user_id = uid;
$$;

create or replace function app.is_org_member(org uuid, uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = org and m.user_id = uid
  );
$$;

create or replace function app.org_role(org uuid, uid uuid default auth.uid())
returns public.org_role
language sql
stable
security definer
set search_path = ''
as $$
  select m.role from public.organization_members m
  where m.organization_id = org and m.user_id = uid;
$$;

create or replace function app.has_org_role(org uuid, roles public.org_role[], uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = org
      and m.user_id = uid
      and m.role = any(roles)
  );
$$;

-- Members allowed to create/modify operational records.
create or replace function app.can_write(org uuid, uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.has_org_role(org, array['OWNER','ADMIN','DISPATCHER','STAFF']::public.org_role[], uid);
$$;

-- Members allowed to delete records / manage the organization itself.
create or replace function app.can_manage(org uuid, uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.has_org_role(org, array['OWNER','ADMIN']::public.org_role[], uid);
$$;

grant execute on function
  app.user_organization_ids(uuid),
  app.is_org_member(uuid, uuid),
  app.org_role(uuid, uuid),
  app.has_org_role(uuid, public.org_role[], uuid),
  app.can_write(uuid, uuid),
  app.can_manage(uuid, uuid)
to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Slug generation + atomic organization creation.
--
-- Organizations have no INSERT policy: the only supported way to create one is
-- this RPC, which also creates the caller's OWNER membership in the same
-- transaction. That closes the hole where a user could otherwise attach
-- themselves to an organization they do not own.
-- ---------------------------------------------------------------------------
create or replace function app.slugify(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    nullif(
      trim(both '-' from regexp_replace(lower(btrim(value)), '[^a-z0-9]+', '-', 'g')),
      ''
    ),
    'org'
  );
$$;

create or replace function public.create_organization(
  p_name     text,
  p_phone    text default null,
  p_email    text default null,
  p_city     text default null,
  p_state    text default null,
  p_country  text default 'IN',
  p_timezone text default 'Asia/Kolkata',
  p_currency text default 'INR'
)
returns public.organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_base  text;
  v_slug  text;
  v_try   int := 0;
  v_org   public.organizations;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  v_base := app.slugify(p_name);
  v_slug := v_base;

  loop
    exit when not exists (select 1 from public.organizations o where o.slug = v_slug);
    v_try := v_try + 1;
    if v_try > 50 then
      v_slug := v_base || '-' || substr(extensions.gen_random_uuid()::text, 1, 8);
      exit;
    end if;
    v_slug := v_base || '-' || v_try::text;
  end loop;

  insert into public.organizations (name, slug, phone, email, city, state, country, timezone, currency)
  values (btrim(p_name), v_slug, p_phone, p_email, p_city, p_state,
          coalesce(p_country, 'IN'), coalesce(p_timezone, 'Asia/Kolkata'), coalesce(p_currency, 'INR'))
  returning * into v_org;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_org.id, v_uid, 'OWNER');

  return v_org;
end;
$$;

revoke all on function public.create_organization(text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.create_organization(text, text, text, text, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Per-organization document numbering (quotes, bookings). Row lock keeps
-- concurrent quote creation from handing out the same number twice.
-- ---------------------------------------------------------------------------
create table public.document_counters (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind            text not null check (kind in ('QUOTE', 'BOOKING', 'TRIP_REQUEST')),
  last_value      bigint not null default 0,
  primary key (organization_id, kind)
);

create or replace function app.next_document_number(org uuid, p_kind text, p_prefix text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_next bigint;
begin
  insert into public.document_counters (organization_id, kind, last_value)
  values (org, p_kind, 1)
  on conflict (organization_id, kind)
    do update set last_value = public.document_counters.last_value + 1
  returning last_value into v_next;

  return p_prefix || '-' || lpad(v_next::text, 5, '0');
end;
$$;

grant execute on function app.next_document_number(uuid, text, text) to authenticated, service_role;


-- ######################## 20260812090100_customers_fleet_drivers.sql ########################

-- ===========================================================================
-- Busify AI — 0002: customers, fleet, drivers
--
-- Cross-table references inside a tenant use a COMPOSITE foreign key
-- (organization_id, id) rather than a plain id reference. That makes it
-- structurally impossible to point a row at a parent in another organization,
-- independently of RLS. Each parent therefore carries a
-- `unique (organization_id, id)` key.
--
-- Only one FK is declared per relationship so PostgREST resource embedding
-- stays unambiguous.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------------
create table public.customers (
  id              uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  first_name      text not null check (length(btrim(first_name)) > 0),
  last_name       text,
  email           text,
  phone           text,
  company         text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, id)
);

create index customers_org_idx      on public.customers (organization_id);
create index customers_org_name_idx on public.customers (organization_id, last_name, first_name);
create unique index customers_org_email_unique
  on public.customers (organization_id, lower(email))
  where email is not null and btrim(email) <> '';

create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- vehicle_types
-- ---------------------------------------------------------------------------
create table public.vehicle_types (
  id               uuid primary key default extensions.gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  name             text not null check (length(btrim(name)) > 0),
  description      text,
  default_capacity int check (default_capacity is null or default_capacity between 1 and 200),
  -- Pricing inputs live on the type so quoting stays deterministic (Phase 2).
  base_rate        numeric(12, 2) not null default 0 check (base_rate >= 0),
  per_km_rate      numeric(12, 2) not null default 0 check (per_km_rate >= 0),
  per_hour_rate    numeric(12, 2) not null default 0 check (per_hour_rate >= 0),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, name),
  unique (organization_id, id)
);

create index vehicle_types_org_idx on public.vehicle_types (organization_id);

create trigger vehicle_types_set_updated_at
  before update on public.vehicle_types
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- vehicles
-- ---------------------------------------------------------------------------
create table public.vehicles (
  id                  uuid primary key default extensions.gen_random_uuid(),
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  vehicle_type_id     uuid,
  name                text not null check (length(btrim(name)) > 0),
  registration_number text not null check (length(btrim(registration_number)) > 0),
  capacity            int not null check (capacity between 1 and 200),
  status              public.vehicle_status not null default 'AVAILABLE',
  location            text,
  year                int check (year is null or year between 1950 and 2100),
  make                text,
  model               text,
  image_url           text,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (organization_id, registration_number),
  unique (organization_id, id),
  -- MATCH SIMPLE: a null vehicle_type_id satisfies the constraint.
  foreign key (organization_id, vehicle_type_id)
    references public.vehicle_types (organization_id, id)
    on delete set null
);

create index vehicles_org_idx        on public.vehicles (organization_id);
create index vehicles_org_status_idx on public.vehicles (organization_id, status);
create index vehicles_type_idx       on public.vehicles (vehicle_type_id);

create trigger vehicles_set_updated_at
  before update on public.vehicles
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- vehicle_maintenance
-- ---------------------------------------------------------------------------
create table public.vehicle_maintenance (
  id              uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  vehicle_id      uuid not null,
  title           text not null check (length(btrim(title)) > 0),
  description     text,
  status          public.maintenance_status not null default 'SCHEDULED',
  scheduled_at    timestamptz,
  completed_at    timestamptz,
  cost            numeric(12, 2) check (cost is null or cost >= 0),
  odometer_km     int check (odometer_km is null or odometer_km >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  foreign key (organization_id, vehicle_id)
    references public.vehicles (organization_id, id)
    on delete cascade
);

create index vehicle_maintenance_org_idx     on public.vehicle_maintenance (organization_id);
create index vehicle_maintenance_vehicle_idx on public.vehicle_maintenance (vehicle_id, scheduled_at desc);

create trigger vehicle_maintenance_set_updated_at
  before update on public.vehicle_maintenance
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- drivers
-- ---------------------------------------------------------------------------
create table public.drivers (
  id                 uuid primary key default extensions.gen_random_uuid(),
  organization_id    uuid not null references public.organizations(id) on delete cascade,
  user_id            uuid references auth.users(id) on delete set null,
  first_name         text not null check (length(btrim(first_name)) > 0),
  last_name          text,
  email              text,
  phone              text,
  license_number     text,
  license_expires_on date,
  status             public.driver_status not null default 'ACTIVE',
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (organization_id, user_id),
  unique (organization_id, id)
);

create index drivers_org_idx        on public.drivers (organization_id);
create index drivers_org_status_idx on public.drivers (organization_id, status);
create unique index drivers_org_license_unique
  on public.drivers (organization_id, upper(license_number))
  where license_number is not null and btrim(license_number) <> '';

create trigger drivers_set_updated_at
  before update on public.drivers
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- driver_documents  (files live in the private `driver-documents` bucket)
-- ---------------------------------------------------------------------------
create table public.driver_documents (
  id              uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  driver_id       uuid not null,
  type            public.driver_document_type not null default 'OTHER',
  name            text not null,
  storage_path    text not null,
  issued_on       date,
  expires_on      date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  foreign key (organization_id, driver_id)
    references public.drivers (organization_id, id)
    on delete cascade
);

create index driver_documents_org_idx    on public.driver_documents (organization_id);
create index driver_documents_driver_idx on public.driver_documents (driver_id);

create trigger driver_documents_set_updated_at
  before update on public.driver_documents
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- driver_availability
-- ---------------------------------------------------------------------------
create table public.driver_availability (
  id              uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  driver_id       uuid not null,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  is_available    boolean not null default true,
  reason          text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (ends_at > starts_at),
  foreign key (organization_id, driver_id)
    references public.drivers (organization_id, id)
    on delete cascade
);

create index driver_availability_org_idx    on public.driver_availability (organization_id);
create index driver_availability_window_idx on public.driver_availability (driver_id, starts_at, ends_at);

create trigger driver_availability_set_updated_at
  before update on public.driver_availability
  for each row execute function app.set_updated_at();


-- ######################## 20260812090200_requests_trips_quotes_bookings.sql ########################

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


-- ######################## 20260812090300_rls.sql ########################

-- ===========================================================================
-- Busify AI — 0004: Row Level Security
--
-- Every tenant-owned table is closed by default and reopened only through
-- policies that resolve the caller's memberships. Tenant isolation is enforced
-- here, in the database — the application never filters by organization_id for
-- security, only for ergonomics.
--
-- Role matrix for operational tables:
--   SELECT  any member of the organization
--   INSERT  OWNER, ADMIN, DISPATCHER, STAFF        (app.can_write)
--   UPDATE  OWNER, ADMIN, DISPATCHER, STAFF        (app.can_write)
--   DELETE  OWNER, ADMIN                           (app.can_manage)
-- ACCOUNTANT and DRIVER are read-only, with the financial exception below.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create or replace function app.shares_organization(other_user uuid, uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members mine
    join public.organization_members theirs
      on theirs.organization_id = mine.organization_id
    where mine.user_id = uid
      and theirs.user_id = other_user
  );
$$;

grant execute on function app.shares_organization(uuid, uuid) to authenticated, service_role;

alter table public.profiles enable row level security;

create policy "profiles: read self or teammates"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or app.shares_organization(id, (select auth.uid())));

create policy "profiles: insert self"
  on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));

create policy "profiles: update self"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- organizations
--
-- No INSERT policy on purpose: organizations may only be created through
-- public.create_organization(), which also creates the OWNER membership.
-- ---------------------------------------------------------------------------
alter table public.organizations enable row level security;

create policy "organizations: members read"
  on public.organizations for select to authenticated
  using (app.is_org_member(id, (select auth.uid())));

create policy "organizations: owners and admins update"
  on public.organizations for update to authenticated
  using (app.can_manage(id, (select auth.uid())))
  with check (app.can_manage(id, (select auth.uid())));

create policy "organizations: owners delete"
  on public.organizations for delete to authenticated
  using (app.has_org_role(id, array['OWNER']::public.org_role[], (select auth.uid())));

-- ---------------------------------------------------------------------------
-- organization_members
--
-- Policies call SECURITY DEFINER helpers rather than sub-querying this table
-- directly, which would recurse into this very policy.
-- ---------------------------------------------------------------------------
alter table public.organization_members enable row level security;

create policy "members: read own organizations"
  on public.organization_members for select to authenticated
  using (app.is_org_member(organization_id, (select auth.uid())));

create policy "members: owners and admins invite"
  on public.organization_members for insert to authenticated
  with check (app.can_manage(organization_id, (select auth.uid())));

create policy "members: owners and admins update roles"
  on public.organization_members for update to authenticated
  using (app.can_manage(organization_id, (select auth.uid())))
  with check (app.can_manage(organization_id, (select auth.uid())));

create policy "members: owners and admins remove, or leave"
  on public.organization_members for delete to authenticated
  using (
    app.can_manage(organization_id, (select auth.uid()))
    or user_id = (select auth.uid())
  );

-- An organization must always keep at least one OWNER, otherwise nobody can
-- manage or delete it. Guards both demotion and removal of the final owner.
create or replace function app.protect_last_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owners int;
begin
  -- NEW is only assigned on UPDATE, so every branch that touches it is nested
  -- inside an explicit tg_op test rather than relying on AND short-circuiting,
  -- which Postgres does not guarantee.
  if tg_op = 'UPDATE' then
    -- Not an owner row, or an owner staying an owner: nothing to protect.
    if old.role <> 'OWNER' or new.role = 'OWNER' then
      return new;
    end if;
  else
    if old.role <> 'OWNER' then
      return old;
    end if;

    -- Cascade from `delete from organizations`: the parent is already gone in
    -- this transaction, so there is no organization left to protect.
    if not exists (
      select 1 from public.organizations o where o.id = old.organization_id
    ) then
      return old;
    end if;
  end if;

  select count(*) into v_owners
  from public.organization_members m
  where m.organization_id = old.organization_id and m.role = 'OWNER';

  if v_owners <= 1 then
    raise exception 'An organization must have at least one OWNER'
      using errcode = 'check_violation';
  end if;

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

create trigger organization_members_protect_last_owner
  before update or delete on public.organization_members
  for each row execute function app.protect_last_owner();

-- ---------------------------------------------------------------------------
-- Uniform tenant tables
--
-- Generated in a loop so no table can silently drift out of the matrix. Adding
-- a tenant table means adding it to this array in a follow-up migration.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  tenant_tables text[] := array[
    'customers',
    'vehicle_types',
    'vehicles',
    'vehicle_maintenance',
    'drivers',
    'driver_documents',
    'driver_availability',
    'trip_requests',
    'trips',
    'trip_assignments',
    'trip_passengers',
    'quotes',
    'quote_items',
    'bookings',
    'booking_passengers'
  ];
begin
  foreach t in array tenant_tables loop
    execute format('alter table public.%I enable row level security', t);

    execute format($p$
      create policy "%1$s: members read"
        on public.%1$I for select to authenticated
        using (app.is_org_member(organization_id, (select auth.uid())))
    $p$, t);

    execute format($p$
      create policy "%1$s: staff insert"
        on public.%1$I for insert to authenticated
        with check (app.can_write(organization_id, (select auth.uid())))
    $p$, t);

    execute format($p$
      create policy "%1$s: staff update"
        on public.%1$I for update to authenticated
        using (app.can_write(organization_id, (select auth.uid())))
        with check (app.can_write(organization_id, (select auth.uid())))
    $p$, t);

    execute format($p$
      create policy "%1$s: managers delete"
        on public.%1$I for delete to authenticated
        using (app.can_manage(organization_id, (select auth.uid())))
    $p$, t);
  end loop;
end;
$$;

-- Accountants own the money. Additional permissive policies OR-in write access
-- to the financial tables without widening anything else.
do $$
declare
  t text;
  finance_tables text[] := array['quotes', 'quote_items', 'bookings'];
begin
  foreach t in array finance_tables loop
    execute format($p$
      create policy "%1$s: accountants insert"
        on public.%1$I for insert to authenticated
        with check (app.has_org_role(organization_id, array['ACCOUNTANT']::public.org_role[], (select auth.uid())))
    $p$, t);

    execute format($p$
      create policy "%1$s: accountants update"
        on public.%1$I for update to authenticated
        using (app.has_org_role(organization_id, array['ACCOUNTANT']::public.org_role[], (select auth.uid())))
        with check (app.has_org_role(organization_id, array['ACCOUNTANT']::public.org_role[], (select auth.uid())))
    $p$, t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- document_counters
--
-- RLS on with zero policies: unreachable from the API in either direction.
-- Only app.next_document_number() (SECURITY DEFINER) touches it.
-- ---------------------------------------------------------------------------
alter table public.document_counters enable row level security;

-- ---------------------------------------------------------------------------
-- Baseline grants. RLS narrows what these can reach; without them PostgREST
-- would reject the request before a policy is ever evaluated.
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated, anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on public.document_counters from authenticated, anon;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;


-- ######################## 20260812090400_storage.sql ########################

-- ===========================================================================
-- Busify AI — 0005: Storage buckets and their policies
--
-- Path convention for every bucket:  <organization_id>/<...>
-- The first path segment is the tenant key, and the policies below read it
-- back out of the object name. Anything not starting with a UUID the caller
-- belongs to is unreachable.
-- ===========================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('organization-logos', 'organization-logos', true,  2 * 1024 * 1024,
   array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']),
  ('vehicle-images', 'vehicle-images', true, 5 * 1024 * 1024,
   array['image/png', 'image/jpeg', 'image/webp']),
  ('driver-documents', 'driver-documents', false, 10 * 1024 * 1024, null),
  ('customer-attachments', 'customer-attachments', false, 10 * 1024 * 1024, null),
  ('trip-documents', 'trip-documents', false, 10 * 1024 * 1024, null)
on conflict (id) do nothing;

-- Safely pull the tenant UUID out of an object path. Returns null rather than
-- raising when the first segment is not a UUID, so a malformed upload path
-- simply fails the policy.
create or replace function app.storage_org_id(object_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_first text := split_part(coalesce(object_name, ''), '/', 1);
begin
  if v_first !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;
  return v_first::uuid;
end;
$$;

grant execute on function app.storage_org_id(text) to authenticated, anon, service_role;

-- ---------------------------------------------------------------------------
-- Private buckets: members read, writers write, managers delete.
-- ---------------------------------------------------------------------------
create policy "storage: members read tenant objects"
  on storage.objects for select to authenticated
  using (
    bucket_id in ('driver-documents', 'customer-attachments', 'trip-documents',
                  'organization-logos', 'vehicle-images')
    and app.is_org_member(app.storage_org_id(name), (select auth.uid()))
  );

create policy "storage: writers upload tenant objects"
  on storage.objects for insert to authenticated
  with check (
    bucket_id in ('driver-documents', 'customer-attachments', 'trip-documents',
                  'organization-logos', 'vehicle-images')
    and app.can_write(app.storage_org_id(name), (select auth.uid()))
  );

create policy "storage: writers replace tenant objects"
  on storage.objects for update to authenticated
  using (
    bucket_id in ('driver-documents', 'customer-attachments', 'trip-documents',
                  'organization-logos', 'vehicle-images')
    and app.can_write(app.storage_org_id(name), (select auth.uid()))
  )
  with check (
    bucket_id in ('driver-documents', 'customer-attachments', 'trip-documents',
                  'organization-logos', 'vehicle-images')
    and app.can_write(app.storage_org_id(name), (select auth.uid()))
  );

create policy "storage: managers delete tenant objects"
  on storage.objects for delete to authenticated
  using (
    bucket_id in ('driver-documents', 'customer-attachments', 'trip-documents',
                  'organization-logos', 'vehicle-images')
    and app.can_manage(app.storage_org_id(name), (select auth.uid()))
  );

