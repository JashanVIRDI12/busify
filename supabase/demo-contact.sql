-- ===========================================================================
-- Busify — point the flagship demo quote at an address mail can actually reach
--
--   npx supabase db query --linked -f supabase/demo-contact.sql
--
-- Resend's shared sender (onboarding@resend.dev) only delivers to the address
-- that owns the Resend account. Until a domain is verified, that one address is
-- the only place an email can land — so the demo contact uses it, and "Email
-- quote" can be shown working rather than described.
--
-- Change DEMO_EMAIL below once a real sending domain is verified.
-- ===========================================================================

do $$
declare
  v_org   uuid;
  v_cust  uuid;
  v_email text := 'jashanvirdi12@gmail.com';
begin
  select id into v_org from public.organizations order by created_at limit 1;
  if v_org is null then
    raise notice 'No organization found.';
    return;
  end if;

  insert into public.customers
    (organization_id, first_name, last_name, email, phone, company, job_title, city, province)
  select v_org, 'Demo', 'Client', v_email, '(416) 555-0100',
         'Northfield Secondary School', 'Trip Coordinator', 'Toronto', 'ON'
  where not exists (
    select 1 from public.customers where organization_id = v_org and email = v_email
  );

  select id into v_cust
    from public.customers
   where organization_id = v_org and email = v_email;

  -- The richest quote in the pipeline, so the emailed PDF has real content.
  update public.quotes
     set customer_id = v_cust
   where organization_id = v_org
     and title = 'Northfield Ottawa trip';

  raise notice 'Demo contact wired to %', v_email;
end;
$$;
