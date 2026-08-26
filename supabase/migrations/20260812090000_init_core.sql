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
