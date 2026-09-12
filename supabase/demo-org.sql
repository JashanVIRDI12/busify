-- ===========================================================================
-- Busify — a self-contained demo tenant
--
--   npx supabase db query --linked -f supabase/demo-org.sql
--   npx supabase db query --linked -f supabase/demo-viabus.sql
--
-- Creates an organization purely for showing the product, separate from the
-- one a real operator works in. Nothing here touches live data: a demo account
-- signed into this tenant can see only this tenant, because RLS scopes every
-- table by organization_id rather than the application filtering afterwards.
--
-- The auth account itself is created outside SQL — auth.users needs the admin
-- API to get a usable password hash and identity row. Run:
--
--   node scripts/make-demo-user.mjs
--
-- which creates demo@viabus.ca and joins it to this organization as OWNER.
--
-- Inserting the organization fires organizations_seed_settings, so the tenant
-- arrives with its settings row, industry list and email templates already in
-- place — the same state a real signup lands in.
-- ===========================================================================

do $$
declare
  v_org_name constant text := 'Via Bus Demo';
  v_org uuid;
begin
  select id into v_org from public.organizations where name = v_org_name;

  if v_org is not null then
    raise notice 'Demo organization already exists (%)', v_org;
    return;
  end if;

  insert into public.organizations
    (name, slug, phone, email, address, city, state, country, postal_code,
     timezone, currency, website)
  values
    (v_org_name, 'via-bus-demo', '(416) 555-0100', 'dispatch@viabus.test',
     '120 Carlingview Dr', 'Toronto', 'ON', 'CA', 'M9W 5E7',
     'America/Toronto', 'CAD', 'https://viabus.test')
  returning id into v_org;

  raise notice 'Created demo organization %', v_org;
end;
$$;
