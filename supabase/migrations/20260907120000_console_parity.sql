-- ===========================================================================
-- Busify — console parity
--
-- Adds the entities the operations console needs that the charter core did not
-- model: companies as first-class records, support tickets, driver pay, saved
-- list views, and the reservation-side columns (money owed, invoice state,
-- garage timing) that turn a `trip` into what the product calls a reservation.
--
-- Numbering is the significant decision here. Busify shows one number line for
-- both quotes and reservations: quote 11423 becomes reservation 11423, and its
-- second vehicle becomes 11423-2. That is not cosmetic — an operator, a driver
-- and a customer all say "eleven four twenty-three" about the same job through
-- its whole life. So a single per-organization record counter feeds both, and
-- a trip created from a quote inherits that quote's number rather than taking
-- a new one.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.ticket_status as enum (
  'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'
);

create type public.ticket_severity as enum (
  'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
);

create type public.driver_pay_status as enum (
  'DRAFT', 'PENDING', 'APPROVED', 'PAID', 'VOID'
);

create type public.reservation_payment_status as enum (
  'UNPAID', 'PARTIAL', 'PAID', 'REFUNDED'
);

-- ---------------------------------------------------------------------------
-- Shared record numbering
-- ---------------------------------------------------------------------------
alter table public.document_counters
  drop constraint if exists document_counters_kind_check;

alter table public.document_counters
  add constraint document_counters_kind_check
  check (kind in ('QUOTE', 'BOOKING', 'TRIP_REQUEST', 'RECORD', 'TICKET', 'PAY_STUB'));

-- Starts the visible number line at 10001 rather than 1. A five-digit job
-- number is unambiguous over a phone in a way that "7" is not.
create or replace function app.next_record_number(org uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_next bigint;
begin
  insert into public.document_counters (organization_id, kind, last_value)
  values (org, 'RECORD', 1)
  on conflict (organization_id, kind)
    do update set last_value = public.document_counters.last_value + 1
  returning last_value into v_next;

  return (10000 + v_next)::text;
end;
$$;

grant execute on function app.next_record_number(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- companies
--
-- Not unique on name on purpose: two school boards genuinely do run separate
-- accounts under one name, and refusing the second one would push the operator
-- into "Ancaster Avalanche (2)" workarounds that are worse than the duplicate.
-- ---------------------------------------------------------------------------
create table public.companies (
  id              uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null check (length(btrim(name)) > 0),
  website         text,
  email           text,
  phone           text,
  fax             text,
  address_line1   text,
  address_line2   text,
  city            text,
  province        text,
  postal_code     text,
  country         text not null default 'CA',
  industry        text,
  groups          text[] not null default '{}',
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, id)
);

create index companies_org_idx      on public.companies (organization_id);
create index companies_org_name_idx on public.companies (organization_id, name);

create trigger companies_set_updated_at
  before update on public.companies
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- customers — the console calls these contacts, and shows their postal address
-- ---------------------------------------------------------------------------
alter table public.customers
  add column if not exists company_id       uuid,
  add column if not exists job_title        text,
  add column if not exists phone_extension  text,
  add column if not exists address_line1    text,
  add column if not exists address_line2    text,
  add column if not exists city             text,
  add column if not exists province         text,
  add column if not exists postal_code      text,
  add column if not exists country          text not null default 'CA',
  add column if not exists industry         text;

alter table public.customers
  drop constraint if exists customers_company_fk;

alter table public.customers
  add constraint customers_company_fk
    foreign key (organization_id, company_id)
    references public.companies (organization_id, id) on delete set null;

create index if not exists customers_company_idx on public.customers (company_id);

-- ---------------------------------------------------------------------------
-- vehicles
--
-- `registration_number` was required and is the licence plate under another
-- name. The console collects a plate and a VIN, and neither is known when a
-- coach is first entered from a spreadsheet, so the plate stops being mandatory.
-- ---------------------------------------------------------------------------
alter table public.vehicles
  alter column registration_number drop not null;

alter table public.vehicles
  add column if not exists garage_id    uuid,
  add column if not exists vin          text,
  add column if not exists amenities    text[] not null default '{}',
  add column if not exists is_mock      boolean not null default false,
  add column if not exists external_ref text;

comment on column public.vehicles.is_mock is
  'A placeholder coach used to hold a booking. Excluded from availability.';

alter table public.vehicles
  drop constraint if exists vehicles_garage_fk;

alter table public.vehicles
  add constraint vehicles_garage_fk
    foreign key (organization_id, garage_id)
    references public.garages (organization_id, id) on delete set null;

create index if not exists vehicles_garage_idx on public.vehicles (garage_id);

-- ---------------------------------------------------------------------------
-- drivers
-- ---------------------------------------------------------------------------
alter table public.drivers
  add column if not exists garage_id uuid;

alter table public.drivers
  drop constraint if exists drivers_garage_fk;

alter table public.drivers
  add constraint drivers_garage_fk
    foreign key (organization_id, garage_id)
    references public.garages (organization_id, id) on delete set null;

create index if not exists drivers_garage_idx on public.drivers (garage_id);

-- ---------------------------------------------------------------------------
-- quotes — the columns the quotes list shows
-- ---------------------------------------------------------------------------
alter table public.quotes
  add column if not exists reference  text,
  add column if not exists company_id uuid,
  add column if not exists event_type text,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists expires_at timestamptz,
  -- Denormalised from the first stop of the first trip. The quotes list sorts
  -- and filters on pickup date, and reaching two tables deep through an embed
  -- to do that would make the most-used screen in the product the slowest.
  -- The builder already recomputes everything server-side on save, so this is
  -- written in the same statement as the rolled-up totals.
  add column if not exists pickup_at      timestamptz,
  add column if not exists pickup_address text;

create index if not exists quotes_org_pickup_idx
  on public.quotes (organization_id, pickup_at);

alter table public.quotes
  drop constraint if exists quotes_company_fk;

alter table public.quotes
  add constraint quotes_company_fk
    foreign key (organization_id, company_id)
    references public.companies (organization_id, id) on delete set null;

create unique index if not exists quotes_org_reference_unique
  on public.quotes (organization_id, reference)
  where reference is not null;

create or replace function app.assign_quote_reference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.reference is null or btrim(new.reference) = '' then
    new.reference := app.next_record_number(new.organization_id);
  end if;
  return new;
end;
$$;

create trigger quotes_assign_reference
  before insert on public.quotes
  for each row execute function app.assign_quote_reference();

-- ---------------------------------------------------------------------------
-- trips — reservations
-- ---------------------------------------------------------------------------
alter table public.trips
  add column if not exists reference        text,
  add column if not exists quote_id         uuid,
  add column if not exists company_id       uuid,
  add column if not exists garage_id        uuid,
  add column if not exists group_name       text,
  add column if not exists total_due        numeric(12, 2) not null default 0 check (total_due >= 0),
  add column if not exists amount_paid      numeric(12, 2) not null default 0 check (amount_paid >= 0),
  add column if not exists payment_status   public.reservation_payment_status not null default 'UNPAID',
  add column if not exists invoice_sent_at  timestamptz,
  add column if not exists garage_arrival_at timestamptz,
  add column if not exists spot_at          timestamptz,
  add column if not exists dropoff_at       timestamptz,
  add column if not exists last_activity_at timestamptz not null default now(),
  add column if not exists created_by       uuid references auth.users(id) on delete set null;

-- Balance is never written, only read. Storing it as an ordinary column is how
-- lists quietly drift out of sync with the payments that produced them.
alter table public.trips
  add column if not exists balance_due numeric(12, 2)
    generated always as (total_due - amount_paid) stored;

alter table public.trips
  drop constraint if exists trips_quote_fk,
  drop constraint if exists trips_company_fk,
  drop constraint if exists trips_garage_fk;

alter table public.trips
  add constraint trips_quote_fk
    foreign key (organization_id, quote_id)
    references public.quotes (organization_id, id) on delete set null,
  add constraint trips_company_fk
    foreign key (organization_id, company_id)
    references public.companies (organization_id, id) on delete set null,
  add constraint trips_garage_fk
    foreign key (organization_id, garage_id)
    references public.garages (organization_id, id) on delete set null;

create unique index if not exists trips_org_reference_unique
  on public.trips (organization_id, reference)
  where reference is not null;

create index if not exists trips_org_activity_idx on public.trips (organization_id, last_activity_at desc);
create index if not exists trips_quote_idx        on public.trips (quote_id);
create index if not exists trips_company_idx      on public.trips (company_id);

-- A trip born from a quote keeps the quote's number, suffixed per trip. The
-- suffix counts existing siblings rather than using a sequence so the numbers
-- stay dense and predictable when a reservation is split.
create or replace function app.assign_trip_reference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base     text;
  v_siblings int;
begin
  if new.reference is not null and btrim(new.reference) <> '' then
    return new;
  end if;

  if new.quote_id is null then
    new.reference := app.next_record_number(new.organization_id);
    return new;
  end if;

  select q.reference into v_base
  from public.quotes q
  where q.id = new.quote_id;

  if v_base is null then
    new.reference := app.next_record_number(new.organization_id);
    return new;
  end if;

  select count(*) into v_siblings
  from public.trips t
  where t.organization_id = new.organization_id
    and t.quote_id = new.quote_id;

  new.reference := case
    when v_siblings = 0 then v_base
    else v_base || '-' || (v_siblings + 1)::text
  end;

  return new;
end;
$$;

create trigger trips_assign_reference
  before insert on public.trips
  for each row execute function app.assign_trip_reference();

-- ---------------------------------------------------------------------------
-- Assignment status
--
-- The dispatch views exist to answer one question: what is not covered yet.
-- Deriving that per row means a correlated count over trip_assignments on every
-- render of a 1,600-row list, and "unassigned" cannot be expressed as a filter
-- on an embedded resource at all. So it is maintained here, by the only
-- statements that can change the answer.
-- ---------------------------------------------------------------------------
alter table public.trips
  add column if not exists assignment_status text not null default 'UNASSIGNED'
    check (assignment_status in ('UNASSIGNED', 'PARTIAL', 'ASSIGNED'));

create index if not exists trips_org_assignment_idx
  on public.trips (organization_id, assignment_status);

create or replace function app.recompute_trip_assignment_status(p_trip uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total    int;
  v_complete int;
begin
  select count(*),
         count(*) filter (where vehicle_id is not null and driver_id is not null)
    into v_total, v_complete
  from public.trip_assignments
  where trip_id = p_trip;

  update public.trips
     set assignment_status = case
           when v_total = 0 then 'UNASSIGNED'
           when v_complete = v_total then 'ASSIGNED'
           else 'PARTIAL'
         end
   where id = p_trip
     -- Skip the write when nothing changed, so this does not fire the
     -- last-activity trigger on every unrelated assignment edit.
     and assignment_status is distinct from case
           when v_total = 0 then 'UNASSIGNED'
           when v_complete = v_total then 'ASSIGNED'
           else 'PARTIAL'
         end;
end;
$$;

create or replace function app.sync_trip_assignment_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform app.recompute_trip_assignment_status(old.trip_id);
    return old;
  end if;

  perform app.recompute_trip_assignment_status(new.trip_id);
  -- An assignment moved between reservations: both ends need recomputing.
  if tg_op = 'UPDATE' and old.trip_id <> new.trip_id then
    perform app.recompute_trip_assignment_status(old.trip_id);
  end if;

  return new;
end;
$$;

create trigger trip_assignments_sync_status
  after insert or update or delete on public.trip_assignments
  for each row execute function app.sync_trip_assignment_status();

-- Any edit to a reservation is what the Last Activity column reports.
create or replace function app.touch_trip_activity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.last_activity_at := now();
  return new;
end;
$$;

create trigger trips_touch_activity
  before update on public.trips
  for each row execute function app.touch_trip_activity();

-- ---------------------------------------------------------------------------
-- tickets
-- ---------------------------------------------------------------------------
create table public.tickets (
  id              uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reference       text,
  trip_id         uuid,
  title           text not null check (length(btrim(title)) > 0),
  ticket_type     text,
  status          public.ticket_status not null default 'OPEN',
  severity        public.ticket_severity not null default 'MEDIUM',
  assignee_id     uuid references auth.users(id) on delete set null,
  created_by      uuid references auth.users(id) on delete set null,
  body            text,
  resolved_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, trip_id)
    references public.trips (organization_id, id) on delete set null
);

create index tickets_org_status_idx on public.tickets (organization_id, status);
create index tickets_trip_idx       on public.tickets (trip_id);

create unique index tickets_org_reference_unique
  on public.tickets (organization_id, reference)
  where reference is not null;

create trigger tickets_set_updated_at
  before update on public.tickets
  for each row execute function app.set_updated_at();

create or replace function app.assign_ticket_reference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.reference is null or btrim(new.reference) = '' then
    new.reference := app.next_document_number(new.organization_id, 'TICKET', 'T');
  end if;
  return new;
end;
$$;

create trigger tickets_assign_reference
  before insert on public.tickets
  for each row execute function app.assign_ticket_reference();

create table public.ticket_comments (
  id              uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ticket_id       uuid not null,
  author_id       uuid references auth.users(id) on delete set null,
  body            text not null check (length(btrim(body)) > 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  foreign key (organization_id, ticket_id)
    references public.tickets (organization_id, id) on delete cascade
);

create index ticket_comments_ticket_idx on public.ticket_comments (ticket_id, created_at);

create trigger ticket_comments_set_updated_at
  before update on public.ticket_comments
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- driver pay
--
-- Two levels: an entry per driver per reservation, and a stub that groups
-- entries into one payment. An entry can exist with no stub (the Draft state
-- the console opens on) but a stub's total is only ever the sum of its entries.
-- ---------------------------------------------------------------------------
create table public.driver_pay_stubs (
  id              uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reference       text not null,
  driver_id       uuid not null,
  status          public.driver_pay_status not null default 'PENDING',
  total_pay       numeric(12, 2) not null default 0 check (total_pay >= 0),
  payment_date    date,
  period_start    date,
  period_end      date,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, reference),
  check (period_end is null or period_start is null or period_end >= period_start),
  foreign key (organization_id, driver_id)
    references public.drivers (organization_id, id) on delete cascade
);

create index driver_pay_stubs_org_idx    on public.driver_pay_stubs (organization_id, status);
create index driver_pay_stubs_driver_idx on public.driver_pay_stubs (driver_id);

create trigger driver_pay_stubs_set_updated_at
  before update on public.driver_pay_stubs
  for each row execute function app.set_updated_at();

create table public.driver_pay_entries (
  id              uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  trip_id         uuid not null,
  driver_id       uuid not null,
  pay_stub_id     uuid,
  status          public.driver_pay_status not null default 'DRAFT',
  rate_basis      text not null default 'FLAT'
    check (rate_basis in ('FLAT', 'HOURLY', 'DAILY', 'MILEAGE')),
  rate            numeric(12, 2) not null default 0 check (rate >= 0),
  quantity        numeric(12, 2) not null default 0 check (quantity >= 0),
  total_pay       numeric(12, 2) not null default 0 check (total_pay >= 0),
  starts_at       timestamptz,
  ends_at         timestamptz,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, trip_id, driver_id),
  foreign key (organization_id, trip_id)
    references public.trips (organization_id, id) on delete cascade,
  foreign key (organization_id, driver_id)
    references public.drivers (organization_id, id) on delete cascade,
  foreign key (organization_id, pay_stub_id)
    references public.driver_pay_stubs (organization_id, id) on delete set null
);

create index driver_pay_entries_org_idx    on public.driver_pay_entries (organization_id, status);
create index driver_pay_entries_driver_idx on public.driver_pay_entries (driver_id);
create index driver_pay_entries_stub_idx   on public.driver_pay_entries (pay_stub_id);

create trigger driver_pay_entries_set_updated_at
  before update on public.driver_pay_entries
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- quote_files — the attachments panel on the quote builder
--
-- Bytes live in storage; this table is the index. Keeping the metadata in
-- Postgres rather than listing the bucket means the panel can be rendered in
-- the same round trip as the rest of the quote, and a file keeps its original
-- name even though the object is stored under a generated one.
-- ---------------------------------------------------------------------------
create table public.quote_files (
  id              uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  quote_id        uuid not null,
  name            text not null check (length(btrim(name)) > 0),
  storage_path    text not null,
  size_bytes      bigint not null default 0 check (size_bytes >= 0),
  content_type    text,
  uploaded_by     uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, id),
  unique (storage_path),
  foreign key (organization_id, quote_id)
    references public.quotes (organization_id, id) on delete cascade
);

create index quote_files_quote_idx on public.quote_files (quote_id, created_at);

create trigger quote_files_set_updated_at
  before update on public.quote_files
  for each row execute function app.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('quote-files', 'quote-files', false, 10 * 1024 * 1024, null)
on conflict (id) do nothing;

-- The policies in the storage migration list their buckets literally, so this
-- bucket gets its own set rather than those being rewritten. Same rule, same
-- path convention: the first segment of the object name is the tenant.
create policy "storage: members read quote files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'quote-files'
    and app.is_org_member(app.storage_org_id(name), (select auth.uid()))
  );

create policy "storage: writers upload quote files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'quote-files'
    and app.can_write(app.storage_org_id(name), (select auth.uid()))
  );

create policy "storage: writers replace quote files"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'quote-files'
    and app.can_write(app.storage_org_id(name), (select auth.uid()))
  )
  with check (
    bucket_id = 'quote-files'
    and app.can_write(app.storage_org_id(name), (select auth.uid()))
  );

create policy "storage: writers delete quote files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'quote-files'
    and app.can_write(app.storage_org_id(name), (select auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- saved_views
--
-- The filter chips above every list. Stored per user rather than per
-- organization: "Unpaid, next 3 days" is one dispatcher's working set, and
-- sharing it by default would make the chip row unreadable on a team of six.
-- A view can be shared explicitly, which is what `is_shared` is for.
-- ---------------------------------------------------------------------------
create table public.saved_views (
  id              uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  resource        text not null check (length(btrim(resource)) > 0),
  name            text not null check (length(btrim(name)) between 1 and 60),
  query           text not null default '',
  position        int not null default 0,
  is_shared       boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, user_id, resource, name)
);

create index saved_views_lookup_idx
  on public.saved_views (organization_id, resource, position);

create trigger saved_views_set_updated_at
  before update on public.saved_views
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  tenant_tables text[] := array[
    'companies',
    'tickets',
    'ticket_comments',
    'driver_pay_stubs',
    'driver_pay_entries',
    'quote_files'
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

-- Accountants own driver pay outright, the same exception the quote financial
-- tables already carry.
do $$
declare
  t text;
  finance_tables text[] := array['driver_pay_stubs', 'driver_pay_entries'];
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

-- saved_views is not in the loop above: it is per-user, so the matrix is
-- "read anything shared with my organization, write only my own".
alter table public.saved_views enable row level security;

create policy "saved_views: read own or shared"
  on public.saved_views for select to authenticated
  using (
    app.is_org_member(organization_id, (select auth.uid()))
    and (is_shared or user_id = (select auth.uid()))
  );

create policy "saved_views: insert own"
  on public.saved_views for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and app.is_org_member(organization_id, (select auth.uid()))
  );

create policy "saved_views: update own"
  on public.saved_views for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "saved_views: delete own"
  on public.saved_views for delete to authenticated
  using (user_id = (select auth.uid()));
