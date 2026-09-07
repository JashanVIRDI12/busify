-- ===========================================================================
-- Seed defaults for rows created *after* the settings migration ran.
--
-- The settings migration backfilled email templates and the rate card for the
-- organizations and vehicle types that existed at the time it ran. On an empty
-- database that is nothing, so a brand-new deployment ended up with an
-- organization that had no email templates and vehicle types with no rates —
-- the Templates screen and Vehicle Rates screen both opened empty, and the
-- quote builder priced everything at zero.
--
-- Backfilling once was the bug. These are triggers, so the defaults exist for
-- every organization and every vehicle type from now on, whenever they appear.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Email templates follow the organization
-- ---------------------------------------------------------------------------
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

  insert into public.email_templates (organization_id, kind, subject, body)
  select
    new.id,
    t.kind::public.email_template_kind,
    t.subject,
    t.body
  from (values
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
     'Thank you for your enquiry.\n\n'
     'Here is the quote you asked for.\n\n'
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

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- A rate card row follows the vehicle type
--
-- Created empty rather than guessed: a zero rate that an operator has to fill
-- in is honest, where an invented one silently quotes the wrong price.
-- ---------------------------------------------------------------------------
create or replace function app.seed_vehicle_type_rate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.vehicle_rates (
    organization_id, vehicle_type_id, vehicle_id,
    live_mile_rate, dead_mile_rate, hourly_rate, minimum_hours, daily_rate
  )
  values (
    new.organization_id, new.id, null,
    new.per_km_rate, new.per_km_rate, new.per_hour_rate, 6, new.per_day_rate
  )
  on conflict (organization_id, vehicle_type_id, vehicle_id) do nothing;

  return new;
end;
$$;

create trigger vehicle_types_seed_rate
  after insert on public.vehicle_types
  for each row execute function app.seed_vehicle_type_rate();

-- ---------------------------------------------------------------------------
-- Catch up anything that already exists
-- ---------------------------------------------------------------------------
insert into public.organization_settings (organization_id)
select id from public.organizations
on conflict (organization_id) do nothing;

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
   'Thank you for your enquiry.\n\n'
   'Here is the quote you asked for.\n\n'
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

insert into public.vehicle_rates (
  organization_id, vehicle_type_id, vehicle_id,
  live_mile_rate, dead_mile_rate, hourly_rate, minimum_hours, daily_rate
)
select
  vt.organization_id, vt.id, null,
  vt.per_km_rate, vt.per_km_rate, vt.per_hour_rate, 6, vt.per_day_rate
from public.vehicle_types vt
on conflict (organization_id, vehicle_type_id, vehicle_id) do nothing;
