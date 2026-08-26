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
