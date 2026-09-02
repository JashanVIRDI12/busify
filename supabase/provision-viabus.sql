-- ===========================================================================
-- VIABUS — one-time provisioning
--
-- This deployment serves a single operator. The schema is still multi-tenant
-- (every table carries organization_id, every RLS policy enforces it), so that
-- operator needs exactly one `organizations` row for anything to attach to.
--
-- Safe to run against production, and safe to run more than once: the insert
-- is idempotent and no existing data is modified.
--
-- Run it in the Supabase SQL editor, or:
--   psql "$DATABASE_URL" -f supabase/provision-viabus.sql
--
-- The slug must match VIABUS_ORG_SLUG in the environment (default: viabus).
-- ===========================================================================

-- 1. The organization ------------------------------------------------------
--    Country, timezone and currency are set explicitly. The column defaults
--    are India/INR, which is wrong for this operator and would quietly put
--    every quote in the wrong currency.

insert into public.organizations (name, slug, country, timezone, currency, email, phone, city, state)
values (
  'VIABUS',
  'viabus',
  'CA',
  'America/Toronto',
  'CAD',
  'hello@viabus.com',      -- shown on the public quote page
  null,
  'Toronto',
  'ON'
)
on conflict (slug) do nothing;


-- 2. Staff access ----------------------------------------------------------
--    There is no signup route: accounts are created by an administrator in
--    the Supabase dashboard (Authentication → Users → Add user), then linked
--    to the organization here.
--
--    Set the email below to the account that should own the portal, then run.
--    Re-running promotes nothing and duplicates nothing.

do $$
declare
  v_email text := 'admin@viabus.com';   -- <<< CHANGE ME before running
  v_org   uuid;
  v_user  uuid;
begin
  select id into v_org from public.organizations where slug = 'viabus';
  select id into v_user from auth.users where lower(email) = lower(v_email);

  if v_org is null then
    raise exception 'No organization with slug "viabus" — did step 1 run?';
  end if;

  if v_user is null then
    raise notice
      'No auth user with email %. Create the account first (Authentication -> Users -> Add user), then re-run this file.',
      v_email;
    return;
  end if;

  -- A profile row is what the dashboard reads names from.
  insert into public.profiles (id, email, full_name)
  values (v_user, v_email, 'VIABUS Admin')
  on conflict (id) do nothing;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_org, v_user, 'OWNER')
  on conflict (organization_id, user_id) do nothing;

  raise notice 'Linked % to VIABUS as OWNER.', v_email;
end $$;
