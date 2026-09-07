-- ===========================================================================
-- Busify — settings
--
-- Everything under Settings that was previously either hard-coded in the
-- application or missing entirely: rate cards, reusable charges, saved stops,
-- industries, email templates, and the operating defaults a quote inherits.
--
-- The split between `organizations` and `organization_settings` is deliberate.
-- `organizations` is the identity record — who the company is, what goes on an
-- invoice. `organization_settings` is how they work — the defaults a new quote
-- starts from. They change on completely different schedules, and keeping them
-- apart stops `organizations` growing into a forty-column table nobody can read.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.charge_category as enum ('CHARGE', 'MARKUP', 'TAX');

create type public.charge_rate_type as enum (
  'FLAT', 'PER_QUANTITY', 'PERCENTAGE'
);

create type public.charge_placement as enum ('ITEMIZED', 'BASE_FARE');

create type public.driver_pay_method as enum ('HOURLY', 'PERCENTAGE');

create type public.driver_pay_switch as enum ('DAILY_RATE', 'HOURS');

create type public.email_template_kind as enum (
  'QUOTE_BOOKING', 'QUOTE_REQUEST', 'INVOICE'
);

create type public.terms_kind as enum ('CONTRACT', 'QUOTE');

-- ---------------------------------------------------------------------------
-- organizations — the company profile and branding fields
-- ---------------------------------------------------------------------------
alter table public.organizations
  add column if not exists website               text,
  add column if not exists email_sender_name     text,
  add column if not exists bcc_email             text,
  add column if not exists sales_phone           text,
  add column if not exists operations_phone      text,
  add column if not exists fax                   text,
  add column if not exists dot_number            text,
  add column if not exists address_line2         text,
  add column if not exists facebook_url          text,
  add column if not exists instagram_url         text,
  add column if not exists twitter_url           text,
  add column if not exists favicon_url           text,
  -- Customer-facing colours, used on the quote PDF and the checkout page.
  add column if not exists brand_primary_color   text
    check (brand_primary_color is null or brand_primary_color ~* '^#[0-9a-f]{6}$'),
  add column if not exists brand_secondary_color text
    check (brand_secondary_color is null or brand_secondary_color ~* '^#[0-9a-f]{6}$');

-- ---------------------------------------------------------------------------
-- organization_settings — one row per organization, created on demand
-- ---------------------------------------------------------------------------
create table public.organization_settings (
  organization_id uuid primary key
    references public.organizations(id) on delete cascade,

  -- Quote defaults
  default_garage_id        uuid,
  pre_trip_arrival_minutes int not null default 15
    check (pre_trip_arrival_minutes between 0 and 480),
  spot_time_minutes        int not null default 30
    check (spot_time_minutes between 0 and 480),

  -- HIGHEST picks the single largest candidate; CHOOSE sums the bases listed
  -- in `pricing_bases`, which is what lets an operator bill daily plus mileage.
  pricing_mode        public.quote_base_fare_mode not null default 'HIGHEST',
  pricing_bases       text[] not null default '{DAILY}',
  customer_visibility public.quote_customer_visibility not null default 'LINE_ITEM_CALCS',

  enable_sales_tax    boolean not null default true,
  enable_tracking_link boolean not null default true,

  event_types         text[] not null default
    '{K-12,Athletics,University,Military,Airlines,Airport Transfer,Wedding,Corporate,Personal,Other}',
  widget_vehicle_types text[] not null default '{}',

  -- Driver pay defaults, mirroring the Pay Options tab
  driver_pay_method        public.driver_pay_method not null default 'HOURLY',
  long_day_enabled         boolean not null default false,
  long_day_hours           int not null default 10 check (long_day_hours between 1 and 24),
  long_day_switch_to       public.driver_pay_switch not null default 'DAILY_RATE',
  overnight_enabled        boolean not null default false,
  overnight_switch_to      public.driver_pay_switch not null default 'DAILY_RATE',
  percentage_of_total      boolean not null default false,
  pay_rate_types           text[] not null default
    '{Hourly,Daily,Percentage,Per Trip,Mileage,Per diem,Gratuity}',
  per_trip_minimum_enabled boolean not null default false,
  per_trip_minimum_by_hours boolean not null default false,
  per_diem_enabled         boolean not null default false,
  per_diem_min_days        int not null default 1 check (per_diem_min_days between 1 and 30),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint organization_settings_garage_fk
    foreign key (organization_id, default_garage_id)
    references public.garages (organization_id, id) on delete set null
);

create trigger organization_settings_set_updated_at
  before update on public.organization_settings
  for each row execute function app.set_updated_at();

-- Created by trigger rather than by `create_organization()`, so a settings row
-- exists no matter how the organization was made — including by a seed script
-- or by hand in the SQL editor. Every settings page can then read one row and
-- never carry a "not configured yet" branch.
create or replace function app.seed_organization_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.organization_settings (organization_id)
  values (new.id)
  on conflict (organization_id) do nothing;

  insert into public.industries (organization_id, name)
  select new.id, i.name
  from (values
    ('Tourism'), ('Schools'), ('Corporation'), ('Sports Team'),
    ('Government'), ('Religious Organization'), ('Wedding'), ('Other')
  ) as i(name)
  on conflict (organization_id, name) do nothing;

  return new;
end;
$$;

create trigger organizations_seed_settings
  after insert on public.organizations
  for each row execute function app.seed_organization_settings();

-- ---------------------------------------------------------------------------
-- vehicle_rates — the rate card
--
-- A row with a null `vehicle_id` is the default for its type; a row naming a
-- vehicle overrides it for that coach alone. That is why there is no unique
-- constraint on the type: "Charter Bus / Default" and "Charter Bus / 3504" both
-- have to exist.
-- ---------------------------------------------------------------------------
create table public.vehicle_rates (
  id              uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  vehicle_type_id uuid,
  vehicle_id      uuid,
  live_mile_rate  numeric(12, 2) not null default 0 check (live_mile_rate >= 0),
  dead_mile_rate  numeric(12, 2) not null default 0 check (dead_mile_rate >= 0),
  hourly_rate     numeric(12, 2) not null default 0 check (hourly_rate >= 0),
  minimum_hours   numeric(6, 2) not null default 0 check (minimum_hours >= 0),
  daily_rate      numeric(12, 2) not null default 0 check (daily_rate >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, id),
  -- One default per type, and one override per vehicle.
  unique (organization_id, vehicle_type_id, vehicle_id),
  foreign key (organization_id, vehicle_type_id)
    references public.vehicle_types (organization_id, id) on delete cascade,
  foreign key (organization_id, vehicle_id)
    references public.vehicles (organization_id, id) on delete cascade
);

create index vehicle_rates_org_idx on public.vehicle_rates (organization_id);

create trigger vehicle_rates_set_updated_at
  before update on public.vehicle_rates
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- custom_charges — charges, markups and taxes
--
-- All three tabs are the same shape, so they are one table with a category
-- rather than three near-identical ones. A tax here is a *reusable definition*
-- an operator maintains; the rate actually applied to a quote is still copied
-- onto `quote_trip_charges` at save time, because rates change and a sent quote
-- must not.
-- ---------------------------------------------------------------------------
create table public.custom_charges (
  id               uuid primary key default extensions.gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  category         public.charge_category not null default 'CHARGE',
  name             text not null check (length(btrim(name)) > 0),
  rate_type        public.charge_rate_type not null default 'FLAT',
  rate             numeric(12, 4) not null default 0 check (rate >= 0),
  placement        public.charge_placement not null default 'ITEMIZED',
  tax_exempt       boolean not null default false,
  default_on_quote boolean not null default false,
  note             text,
  position         int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, category, name)
);

create index custom_charges_org_idx on public.custom_charges (organization_id, category, position);

create trigger custom_charges_set_updated_at
  before update on public.custom_charges
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- saved_stops — addresses an operator uses over and over
-- ---------------------------------------------------------------------------
create table public.saved_stops (
  id              uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null check (length(btrim(name)) > 0),
  address         text,
  latitude        numeric(9, 6),
  longitude       numeric(9, 6),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, name)
);

create index saved_stops_org_idx on public.saved_stops (organization_id, name);

create trigger saved_stops_set_updated_at
  before update on public.saved_stops
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- industries
--
-- `reference` is the short number the console shows. It comes from a shared
-- identity sequence rather than a per-tenant counter because it is only ever a
-- label — nothing is looked up by it, and a global sequence cannot collide.
-- ---------------------------------------------------------------------------
create table public.industries (
  id              uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reference       bigint generated always as identity (start with 1780) unique,
  name            text not null check (length(btrim(name)) > 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, name)
);

create index industries_org_idx on public.industries (organization_id, name);

create trigger industries_set_updated_at
  before update on public.industries
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- email_templates — the customer-facing messages
-- ---------------------------------------------------------------------------
create table public.email_templates (
  id              uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind            public.email_template_kind not null,
  from_email      text,
  subject         text not null default '',
  body            text not null default '',
  include_pdf     boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, kind)
);

create trigger email_templates_set_updated_at
  before update on public.email_templates
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- contract_terms — now covers both the contract and the quote-page terms
-- ---------------------------------------------------------------------------
alter table public.contract_terms
  add column if not exists kind public.terms_kind not null default 'CONTRACT';

-- The old unique (organization_id, name) would stop an operator naming their
-- quote terms the same as their contract terms, which is a normal thing to do.
alter table public.contract_terms
  drop constraint if exists contract_terms_organization_id_name_key;

create unique index if not exists contract_terms_org_kind_name_unique
  on public.contract_terms (organization_id, kind, name);

-- ---------------------------------------------------------------------------
-- Row level security
--
-- Settings are configuration, so writes are manager-only rather than open to
-- every writer: a dispatcher should not be able to change the rate card.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  settings_tables text[] := array[
    'organization_settings',
    'vehicle_rates',
    'custom_charges',
    'saved_stops',
    'industries',
    'email_templates'
  ];
begin
  foreach t in array settings_tables loop
    execute format('alter table public.%I enable row level security', t);

    execute format($p$
      create policy "%1$s: members read"
        on public.%1$I for select to authenticated
        using (app.is_org_member(organization_id, (select auth.uid())))
    $p$, t);

    execute format($p$
      create policy "%1$s: managers insert"
        on public.%1$I for insert to authenticated
        with check (app.can_manage(organization_id, (select auth.uid())))
    $p$, t);

    execute format($p$
      create policy "%1$s: managers update"
        on public.%1$I for update to authenticated
        using (app.can_manage(organization_id, (select auth.uid())))
        with check (app.can_manage(organization_id, (select auth.uid())))
    $p$, t);

    execute format($p$
      create policy "%1$s: managers delete"
        on public.%1$I for delete to authenticated
        using (app.can_manage(organization_id, (select auth.uid())))
    $p$, t);
  end loop;
end;
$$;

-- Saved stops are the exception: a dispatcher building an itinerary should be
-- able to save the stop they just typed, or they will simply retype it forever.
create policy "saved_stops: staff insert"
  on public.saved_stops for insert to authenticated
  with check (app.can_write(organization_id, (select auth.uid())));

create policy "saved_stops: staff update"
  on public.saved_stops for update to authenticated
  using (app.can_write(organization_id, (select auth.uid())))
  with check (app.can_write(organization_id, (select auth.uid())));

-- ---------------------------------------------------------------------------
-- Defaults for organizations that already exist
--
-- Runs once, here, rather than lazily in the application: a settings page that
-- has to cope with "no row yet" on every read grows a null check per field.
-- ---------------------------------------------------------------------------
insert into public.organization_settings (organization_id)
select id from public.organizations
on conflict (organization_id) do nothing;

insert into public.industries (organization_id, name)
select o.id, i.name
from public.organizations o
cross join (values
  ('Tourism'), ('Schools'), ('Corporation'), ('Sports Team'),
  ('Government'), ('Religious Organization'), ('Wedding'), ('Other')
) as i(name)
on conflict (organization_id, name) do nothing;

-- Seed the rate card from the per-type rates already on vehicle_types, so an
-- existing organization opens Vehicle Rates on their real numbers rather than
-- on zeroes.
insert into public.vehicle_rates (
  organization_id, vehicle_type_id, live_mile_rate, dead_mile_rate,
  hourly_rate, minimum_hours, daily_rate
)
select
  vt.organization_id, vt.id, vt.per_km_rate, vt.per_km_rate,
  vt.per_hour_rate, 6, vt.per_day_rate
from public.vehicle_types vt
on conflict (organization_id, vehicle_type_id, vehicle_id) do nothing;

insert into public.email_templates (organization_id, kind, subject, body)
select
  o.id,
  t.kind::public.email_template_kind,
  t.subject,
  t.body
from public.organizations o
cross join (values
  ('QUOTE_BOOKING',
   'Please review your quote',
   E'Hi {{ CONTACT_FIRST_NAME }},\n\n'
   'Thank you for requesting a quote from us.\n\n'
   'Please find your quote details below to complete your booking.\n\n'
   '{{ QUOTE_LINK }}\n\n'
   'We value your business and look forward to providing you with quality service.\n\n'
   'Thanks,\n{{ SENDER_FULL_NAME }}'),
  ('QUOTE_REQUEST',
   'Please review your quote',
   E'Hi {{ CONTACT_FIRST_NAME }},\n\n'
   'Thank you for requesting a quote from us.\n\n'
   'Please find your quote details below to complete your booking.\n\n'
   '{{ QUOTE_LINK }}\n\n'
   'We value your business and look forward to providing you with quality service.\n\n'
   'Thanks,\n{{ SENDER_FULL_NAME }}'),
  ('INVOICE',
   'Your invoice is ready',
   E'Hi {{ CONTACT_FIRST_NAME }},\n\n'
   'Your invoice for reservation {{ RESERVATION_ID }} is attached.\n\n'
   'Thanks,\n{{ SENDER_FULL_NAME }}')
) as t(kind, subject, body)
on conflict (organization_id, kind) do nothing;
