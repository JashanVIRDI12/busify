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
