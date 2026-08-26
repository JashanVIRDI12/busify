-- Paste this whole file into the Supabase SQL editor and run it.
-- Safe to run more than once.
-- ---------------------------------------------------------------------------
-- Canadian localisation
--
-- Busify targets Canadian charter and motorcoach operators. This migration
-- moves the defaults from India to Canada and adds the three fields Canadian
-- operation actually requires:
--
--   * organizations.postal_code    — A1A 1A1, kept apart from the free-text
--                                    address so it can be validated and sorted.
--   * organizations.gst_hst_number — the CRA requires the supplier's GST/HST
--                                    registration number on any invoice of $30
--                                    or more, otherwise the customer cannot
--                                    claim an input tax credit.
--   * drivers.license_class /      — a coach needs Class 2 (or Ontario B/C, or
--     air_brake_endorsement          Quebec 2), and virtually every highway
--                                    coach has air brakes, which is a separate
--                                    endorsement. Holding the wrong class is a
--                                    violation, not a formality.
--
-- Existing rows are left alone. Changing a default does not rewrite history,
-- and silently converting an organization's currency would be a lie about what
-- it has already charged.
-- ---------------------------------------------------------------------------

alter table public.organizations
  alter column country  set default 'CA',
  alter column timezone set default 'America/Toronto',
  alter column currency set default 'CAD';

alter table public.organizations
  add column if not exists postal_code    text,
  add column if not exists gst_hst_number text;

-- Province lives in `state`, which already exists. Constrain it rather than
-- adding a column: the tax rate a quote defaults to is derived from this
-- value, so "Ont." or "ontario" must not be storable.
-- Normalise before constraining, or a row holding "Ontario" or "Delhi" would
-- abort the migration. A value that cannot be resolved to a code is cleared
-- rather than guessed at; the operator picks it again in Settings.
update public.organizations
set state = case upper(btrim(state))
  when 'ALBERTA'                   then 'AB'
  when 'BRITISH COLUMBIA'          then 'BC'
  when 'MANITOBA'                  then 'MB'
  when 'NEW BRUNSWICK'             then 'NB'
  when 'NEWFOUNDLAND AND LABRADOR' then 'NL'
  when 'NEWFOUNDLAND'              then 'NL'
  when 'NOVA SCOTIA'               then 'NS'
  when 'NORTHWEST TERRITORIES'     then 'NT'
  when 'NUNAVUT'                   then 'NU'
  when 'ONTARIO'                   then 'ON'
  when 'PRINCE EDWARD ISLAND'      then 'PE'
  when 'QUEBEC'                    then 'QC'
  when 'QUÉBEC'                    then 'QC'
  when 'SASKATCHEWAN'              then 'SK'
  when 'YUKON'                     then 'YT'
  else upper(btrim(state))
end
where state is not null;

update public.organizations
set state = null
where state is not null
  and state not in ('AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT');

alter table public.organizations
  drop constraint if exists organizations_state_is_province;

alter table public.organizations
  add constraint organizations_state_is_province
  check (
    state is null
    or country <> 'CA'
    or state in ('AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT')
  );

alter table public.organizations
  drop constraint if exists organizations_postal_code_format;

-- D, F, I, O, Q and U never appear in a Canadian postal code; W and Z never
-- lead one. Enforced only for Canadian organizations so a US address entered
-- deliberately is still storable.
alter table public.organizations
  add constraint organizations_postal_code_format
  check (
    postal_code is null
    or country <> 'CA'
    or postal_code ~ '^[ABCEGHJ-NPRSTVXY][0-9][ABCEGHJ-NPRSTV-Z] ?[0-9][ABCEGHJ-NPRSTV-Z][0-9]$'
  );

alter table public.organizations
  drop constraint if exists organizations_gst_hst_number_format;

-- Business Number plus the RT program identifier: 123456789 RT 0001.
alter table public.organizations
  add constraint organizations_gst_hst_number_format
  check (
    gst_hst_number is null
    or replace(upper(gst_hst_number), ' ', '') ~ '^[0-9]{9}RT[0-9]{4}$'
  );

-- ---------------------------------------------------------------------------
-- Drivers
-- ---------------------------------------------------------------------------
alter table public.drivers
  add column if not exists license_class        text,
  add column if not exists air_brake_endorsement boolean not null default false;

alter table public.drivers
  drop constraint if exists drivers_license_class_known;

alter table public.drivers
  add constraint drivers_license_class_known
  check (
    license_class is null
    or license_class in ('1','2','4','ON-B','ON-C','ON-E','ON-F','QC-2','QC-4B')
  );

comment on column public.drivers.air_brake_endorsement is
  'Class Z in Ontario, the air brake endorsement elsewhere. Required to drive a coach with air brakes.';

-- ---------------------------------------------------------------------------
-- Money defaults
-- ---------------------------------------------------------------------------
alter table public.quotes   alter column currency set default 'CAD';
alter table public.bookings alter column currency set default 'CAD';

-- ---------------------------------------------------------------------------
-- create_organization()
--
-- Gains p_postal_code, so the old eight-argument overload has to go: leaving
-- both in place would make the call ambiguous from PostgREST.
-- ---------------------------------------------------------------------------
drop function if exists public.create_organization(text, text, text, text, text, text, text, text);

create or replace function public.create_organization(
  p_name        text,
  p_phone       text default null,
  p_email       text default null,
  p_city        text default null,
  p_state       text default null,
  p_postal_code text default null,
  p_country     text default 'CA',
  p_timezone    text default 'America/Toronto',
  p_currency    text default 'CAD'
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

  insert into public.organizations
    (name, slug, phone, email, city, state, postal_code, country, timezone, currency)
  values
    (btrim(p_name), v_slug, p_phone, p_email, p_city,
     nullif(upper(btrim(coalesce(p_state, ''))), ''),
     nullif(upper(btrim(coalesce(p_postal_code, ''))), ''),
     coalesce(p_country, 'CA'),
     coalesce(p_timezone, 'America/Toronto'),
     coalesce(p_currency, 'CAD'))
  returning * into v_org;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_org.id, v_uid, 'OWNER');

  return v_org;
end;
$$;

revoke all on function public.create_organization(text, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.create_organization(text, text, text, text, text, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Quotes remember the tax they charged
--
-- The rate is not derivable from the stored totals once a discount is in play,
-- and rates change: Nova Scotia was 15% until 1 April 2025 and 14% after. A
-- quote issued in March must keep showing 15%, so the figure is recorded with
-- the document rather than looked up when the page renders.
--
-- `tax_province` is the place of supply, which for passenger transportation is
-- where the journey starts — not where the operator is based.
-- ---------------------------------------------------------------------------
alter table public.quotes
  add column if not exists tax_rate_percent numeric(6, 3) not null default 0,
  add column if not exists tax_province     text;

-- Quotes written before this column existed would otherwise render as
-- "No tax" while showing a tax amount. Recover the rate from the figures that
-- were stored: tax was charged on the subtotal less the discount.
update public.quotes
set tax_rate_percent = round((tax / (subtotal - discount)) * 100, 3)
where tax > 0
  and tax_rate_percent = 0
  and (subtotal - discount) > 0;

alter table public.quotes
  drop constraint if exists quotes_tax_rate_percent_range;

alter table public.quotes
  add constraint quotes_tax_rate_percent_range
  check (tax_rate_percent >= 0 and tax_rate_percent <= 100);

alter table public.quotes
  drop constraint if exists quotes_tax_province_known;

alter table public.quotes
  add constraint quotes_tax_province_known
  check (
    tax_province is null
    or tax_province in ('AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT')
  );
