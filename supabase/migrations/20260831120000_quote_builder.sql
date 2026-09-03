-- ===========================================================================
-- Busify AI — 0006: full quote builder
--
-- Replaces the single-trip quote dialog with Busify's multi-trip quote:
--
--   quotes ─┬─ quote_trips ─┬─ quote_trip_stops     (itinerary)
--           │               ├─ quote_trip_vehicles  (type / specific coach × qty)
--           │               └─ quote_trip_charges    (BASE_FARE | ITEMIZED | TAX)
--           └─ quote_payment_methods                 (Card / Bank / Check / Wire / Other)
--
-- Supporting config:
--   garages          operator depot locations (the "Garage" dropdown)
--   contract_terms   reusable terms & conditions (the "Contract Terms" dropdown)
--
-- Same tenancy rules as the rest of the schema: every cross-table reference
-- inside a tenant uses a composite (organization_id, id) foreign key, and RLS
-- is applied through the four-policy matrix in a loop at the end.
--
-- The legacy `quotes` totals (subtotal/tax/discount/total/deposit_amount) and
-- `quote_items` are kept and written as a flattened mirror by the application,
-- so the customer-facing /quote/[token] page, the accept -> booking flow and
-- the dashboard keep working unchanged while the rich structure lands.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.quote_pipeline_status as enum (
  'LEAD', 'QUOTED', 'FOLLOW_UP', 'WON', 'LOST'
);

create type public.quote_priority as enum ('LOW', 'NORMAL', 'HIGH', 'URGENT');

create type public.quote_trip_type as enum (
  'ONE_WAY', 'ROUND_TRIP', 'HOURLY', 'DAILY', 'SHUTTLE', 'OTHER'
);

create type public.quote_customer_visibility as enum (
  'LINE_ITEM_TOTALS', 'LINE_ITEM_CALCS', 'TOTAL_ONLY'
);

create type public.quote_stop_kind as enum ('PICKUP', 'STOP', 'DROPOFF');

create type public.quote_charge_section as enum ('BASE_FARE', 'ITEMIZED', 'TAX');

create type public.quote_charge_kind as enum (
  'FLAT', 'PERCENT', 'PER_MILE', 'PER_HOUR', 'PER_DAY'
);

create type public.quote_base_fare_mode as enum ('HIGHEST', 'CHOOSE');

create type public.quote_base_fare_basis as enum ('DAILY', 'HOURLY', 'MILEAGE', 'BASE');

create type public.payment_method_kind as enum (
  'CARD', 'BANK', 'CHECK', 'WIRE', 'OTHER'
);

create type public.quote_overage_basis as enum ('HOURLY', 'MILEAGE', 'DAILY');

-- ---------------------------------------------------------------------------
-- vehicle_types — a daily rate, so the "Daily" base-fare candidate has a source
-- ---------------------------------------------------------------------------
alter table public.vehicle_types
  add column if not exists per_day_rate numeric(12, 2) not null default 0
    check (per_day_rate >= 0);

-- ---------------------------------------------------------------------------
-- contract_terms — reusable T&C templates
-- ---------------------------------------------------------------------------
create table public.contract_terms (
  id              uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null check (length(btrim(name)) > 0),
  body            text not null default '',
  is_default      boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, name),
  unique (organization_id, id)
);

create index contract_terms_org_idx on public.contract_terms (organization_id);

create trigger contract_terms_set_updated_at
  before update on public.contract_terms
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- garages — operator depot locations
-- ---------------------------------------------------------------------------
create table public.garages (
  id              uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null check (length(btrim(name)) > 0),
  address         text,
  city            text,
  province        text,
  postal_code     text,
  latitude        numeric(9, 6),
  longitude       numeric(9, 6),
  is_default      boolean not null default false,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, name),
  unique (organization_id, id)
);

create index garages_org_idx on public.garages (organization_id);

create trigger garages_set_updated_at
  before update on public.garages
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- quotes — the builder's header fields
-- ---------------------------------------------------------------------------
alter table public.quotes
  add column if not exists title                text not null default 'New Quote',
  add column if not exists pipeline_status       public.quote_pipeline_status not null default 'LEAD',
  add column if not exists priority              public.quote_priority,
  add column if not exists sales_rep_id          uuid references auth.users(id) on delete set null,
  add column if not exists event_name            text,
  add column if not exists referred_by           text,
  add column if not exists tags                  text[] not null default '{}',
  add column if not exists billing_customer_id   uuid,
  add column if not exists customer_visibility   public.quote_customer_visibility not null default 'LINE_ITEM_CALCS',
  add column if not exists allow_instant_booking boolean not null default true,
  add column if not exists allow_pay_later       boolean not null default false,
  add column if not exists allow_full_card_payment boolean not null default true,
  add column if not exists po_number             text,
  add column if not exists po_only               boolean not null default false,
  add column if not exists payment_policy        text,
  add column if not exists require_signature     boolean not null default false,
  add column if not exists expiry_days           integer check (expiry_days is null or expiry_days between 1 and 365),
  add column if not exists expiry_anchor         text not null default 'LAST_SENT'
    check (expiry_anchor in ('FIRST_SENT', 'LAST_SENT')),
  add column if not exists contract_terms_id     uuid,
  add column if not exists overage_basis         public.quote_overage_basis,
  add column if not exists overage_rate          numeric(12, 2) check (overage_rate is null or overage_rate >= 0),
  add column if not exists first_sent_at         timestamptz;

alter table public.quotes
  drop constraint if exists quotes_billing_customer_fk,
  drop constraint if exists quotes_contract_terms_fk;

alter table public.quotes
  add constraint quotes_billing_customer_fk
    foreign key (organization_id, billing_customer_id)
    references public.customers (organization_id, id) on delete set null,
  add constraint quotes_contract_terms_fk
    foreign key (organization_id, contract_terms_id)
    references public.contract_terms (organization_id, id) on delete set null;

-- ---------------------------------------------------------------------------
-- quote_trips — one per "Trip N" tab
-- ---------------------------------------------------------------------------
create table public.quote_trips (
  id              uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  quote_id        uuid not null,
  position        int not null default 0,
  name            text not null default 'Trip 1',

  trip_type       public.quote_trip_type,
  passenger_count int check (passenger_count is null or passenger_count between 1 and 5000),
  driver_count    int check (driver_count is null or driver_count between 0 and 50),

  trip_contact_name  text,
  trip_contact_email text,
  trip_contact_phone text,

  -- Departing garage
  departing_garage_id   uuid,
  departing_note        text,
  departing_date        date,
  departing_time        time,
  departing_arrival_time time,

  -- Returning garage
  returning_garage_id   uuid,
  returning_note        text,
  returning_date        date,
  returning_time        time,
  -- Distance / time from the last stop back to the returning garage (dead).
  return_leg_miles      numeric(10, 2) not null default 0 check (return_leg_miles >= 0),
  return_leg_minutes    int not null default 0 check (return_leg_minutes >= 0),

  -- Base fare
  base_fare_mode   public.quote_base_fare_mode not null default 'HIGHEST',
  base_fare_basis  public.quote_base_fare_basis,
  rate_daily       numeric(12, 2) not null default 0 check (rate_daily >= 0),
  rate_hourly      numeric(12, 2) not null default 0 check (rate_hourly >= 0),
  rate_per_mile    numeric(12, 4) not null default 0 check (rate_per_mile >= 0),
  rate_flat_base   numeric(12, 2) not null default 0 check (rate_flat_base >= 0),
  base_fare_override numeric(12, 2) check (base_fare_override is null or base_fare_override >= 0),

  -- Metrics
  days             numeric(8, 2) not null default 0 check (days >= 0),
  hours            numeric(8, 2) not null default 0 check (hours >= 0),
  total_miles      numeric(10, 2) not null default 0 check (total_miles >= 0),
  dead_miles       numeric(10, 2) not null default 0 check (dead_miles >= 0),
  live_miles       numeric(10, 2) not null default 0 check (live_miles >= 0),
  estimated_minutes int not null default 0 check (estimated_minutes >= 0),

  -- Rolled-up totals, computed server-side
  base_fare_total  numeric(12, 2) not null default 0,
  subtotal         numeric(12, 2) not null default 0,
  tax_total        numeric(12, 2) not null default 0,
  total            numeric(12, 2) not null default 0,

  -- Payment terms (the Payment tab row for this trip)
  due_now_percent  numeric(6, 3) not null default 0 check (due_now_percent between 0 and 100),
  due_now_amount   numeric(12, 2) check (due_now_amount is null or due_now_amount >= 0),
  balance_due_date date,

  recurrence       jsonb,
  notes            text,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- position is display order only; the app sorts by it. No DB uniqueness, so a
  -- reorder can upsert several rows in one statement without a transient clash.
  unique (organization_id, id),
  foreign key (organization_id, quote_id)
    references public.quotes (organization_id, id) on delete cascade,
  foreign key (organization_id, departing_garage_id)
    references public.garages (organization_id, id) on delete set null,
  foreign key (organization_id, returning_garage_id)
    references public.garages (organization_id, id) on delete set null
);

create index quote_trips_org_idx   on public.quote_trips (organization_id);
create index quote_trips_quote_idx on public.quote_trips (quote_id, position);

create trigger quote_trips_set_updated_at
  before update on public.quote_trips
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- quote_trip_stops — the itinerary
-- ---------------------------------------------------------------------------
create table public.quote_trip_stops (
  id              uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  quote_trip_id   uuid not null,
  position        int not null default 0,
  kind            public.quote_stop_kind not null default 'STOP',
  label           text,
  address         text,
  latitude        numeric(9, 6),
  longitude       numeric(9, 6),
  stop_date       date,
  stop_time       time,
  spot_time       time,
  notes           text,
  -- Distance and drive time from the previous stop.
  leg_miles       numeric(10, 2) not null default 0 check (leg_miles >= 0),
  leg_minutes     int not null default 0 check (leg_minutes >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, quote_trip_id)
    references public.quote_trips (organization_id, id) on delete cascade
);

create index quote_trip_stops_org_idx  on public.quote_trip_stops (organization_id);
create index quote_trip_stops_trip_idx on public.quote_trip_stops (quote_trip_id, position);

create trigger quote_trip_stops_set_updated_at
  before update on public.quote_trip_stops
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- quote_trip_vehicles
-- ---------------------------------------------------------------------------
create table public.quote_trip_vehicles (
  id              uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  quote_trip_id   uuid not null,
  position        int not null default 0,
  vehicle_type_id uuid,
  vehicle_id      uuid,
  quantity        int not null default 1 check (quantity between 1 and 100),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, quote_trip_id)
    references public.quote_trips (organization_id, id) on delete cascade,
  foreign key (organization_id, vehicle_type_id)
    references public.vehicle_types (organization_id, id) on delete set null,
  foreign key (organization_id, vehicle_id)
    references public.vehicles (organization_id, id) on delete set null
);

create index quote_trip_vehicles_org_idx  on public.quote_trip_vehicles (organization_id);
create index quote_trip_vehicles_trip_idx on public.quote_trip_vehicles (quote_trip_id, position);

create trigger quote_trip_vehicles_set_updated_at
  before update on public.quote_trip_vehicles
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- quote_trip_charges — base-fare add-ons, itemized charges, and taxes
-- ---------------------------------------------------------------------------
create table public.quote_trip_charges (
  id              uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  quote_trip_id   uuid not null,
  position        int not null default 0,
  section         public.quote_charge_section not null,
  label           text not null default '',
  kind            public.quote_charge_kind not null default 'FLAT',
  -- The percentage, per-unit price, or flat amount, depending on `kind`.
  rate            numeric(14, 4) not null default 0,
  quantity        numeric(12, 2) not null default 1 check (quantity >= 0),
  amount          numeric(12, 2) not null default 0,
  -- ITEMIZED only: whether TAX rows apply on top of this charge.
  taxable         boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, quote_trip_id)
    references public.quote_trips (organization_id, id) on delete cascade
);

create index quote_trip_charges_org_idx  on public.quote_trip_charges (organization_id);
create index quote_trip_charges_trip_idx on public.quote_trip_charges (quote_trip_id, section, position);

create trigger quote_trip_charges_set_updated_at
  before update on public.quote_trip_charges
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- quote_payment_methods
-- ---------------------------------------------------------------------------
create table public.quote_payment_methods (
  id              uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  quote_id        uuid not null,
  method          public.payment_method_kind not null,
  position        int not null default 0,
  enabled         boolean not null default false,
  online_processing boolean not null default false,
  processing_fee_percent numeric(6, 3) not null default 0 check (processing_fee_percent between 0 and 100),
  customer_note   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, quote_id, method),
  foreign key (organization_id, quote_id)
    references public.quotes (organization_id, id) on delete cascade
);

create index quote_payment_methods_org_idx   on public.quote_payment_methods (organization_id);
create index quote_payment_methods_quote_idx on public.quote_payment_methods (quote_id, position);

create trigger quote_payment_methods_set_updated_at
  before update on public.quote_payment_methods
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — the same four-policy matrix as every other tenant table
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  tenant_tables text[] := array[
    'contract_terms',
    'garages',
    'quote_trips',
    'quote_trip_stops',
    'quote_trip_vehicles',
    'quote_trip_charges',
    'quote_payment_methods'
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

-- Accountants own the money: OR-in write access to the quote sub-tables.
do $$
declare
  t text;
  finance_tables text[] := array[
    'quote_trips',
    'quote_trip_stops',
    'quote_trip_vehicles',
    'quote_trip_charges',
    'quote_payment_methods'
  ];
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
