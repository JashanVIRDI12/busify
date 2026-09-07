-- ===========================================================================
-- Busify AI — demo seed  (LOCAL DEVELOPMENT ONLY)
--
-- Run by `supabase db reset`. Creates two unrelated organizations so tenant
-- isolation can actually be tested: sign in as one owner and confirm the other
-- organization's fleet, drivers and customers are invisible.
--
--   owner@mapleleafcoach.test    / busify123 → Maple Leaf Coach Lines (Ontario)
--   dispatch@mapleleafcoach.test / busify123 → Maple Leaf Coach Lines (DISPATCHER)
--   owner@rivierenord.test       / busify123 → Autocars Rivière-Nord (Quebec)
--
-- The two organizations sit in different provinces so the tax path is
-- exercised as well as the tenancy one: Ontario charges 13% HST, Quebec
-- charges 5% GST plus 9.975% QST.
--
-- Never run against production: it writes directly into auth.users.
-- ===========================================================================

do $$
declare
  v_abc_owner  uuid := '11111111-1111-4111-8111-111111111111';
  v_abc_disp   uuid := '22222222-2222-4222-8222-222222222222';
  v_xyz_owner  uuid := '33333333-3333-4333-8333-333333333333';

  v_abc  uuid := 'aaaaaaaa-0000-4000-8000-000000000001';
  v_xyz  uuid := 'bbbbbbbb-0000-4000-8000-000000000002';

  v_coach   uuid;
  v_minibus uuid;
  v_van     uuid;

  u record;
begin
  -- -------------------------------------------------------------------------
  -- Auth users
  -- -------------------------------------------------------------------------
  for u in
    select * from (values
      (v_abc_owner, 'owner@mapleleafcoach.test',    'Erin Gallagher'),
      (v_abc_disp,  'dispatch@mapleleafcoach.test', 'Owen Fontaine'),
      (v_xyz_owner, 'owner@rivierenord.test',       'Luc Bergeron')
    ) as t(id, email, full_name)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    )
    values (
      '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
      u.email, extensions.crypt('busify123', extensions.gen_salt('bf')),
      now(),
      jsonb_build_object('provider', 'email', 'providers', array['email']),
      jsonb_build_object('full_name', u.full_name),
      now(), now()
    )
    on conflict (id) do nothing;

    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    )
    values (
      extensions.gen_random_uuid(), u.id,
      jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
      'email', u.id::text, now(), now(), now()
    )
    on conflict (provider, provider_id) do nothing;
  end loop;

  -- -------------------------------------------------------------------------
  -- Organizations
  -- -------------------------------------------------------------------------
  -- Two organizations in different provinces on purpose: it makes the tenant
  -- isolation visible, and it exercises the two commonest tax cases, Ontario's
  -- 13% HST and Quebec's GST plus QST.
  insert into public.organizations (id, name, slug, phone, email, address, city, state, postal_code, country, timezone, currency, gst_hst_number)
  values
    (v_abc, 'Maple Leaf Coach Lines', 'maple-leaf-coach-lines', '+1 416 555 0134', 'hello@mapleleafcoach.test',
     '480 Carlingview Drive', 'Toronto', 'ON', 'M9W 5G6', 'CA', 'America/Toronto', 'CAD', '123456789 RT 0001'),
    (v_xyz, 'Autocars Rivière-Nord', 'autocars-riviere-nord', '+1 514 555 0177', 'bonjour@rivierenord.test',
     '1250 rue Notre-Dame Ouest', 'Montréal', 'QC', 'H3C 1K5', 'CA', 'America/Toronto', 'CAD', '987654321 RT 0001')
  on conflict (id) do nothing;

  insert into public.organization_members (organization_id, user_id, role)
  values
    (v_abc, v_abc_owner, 'OWNER'),
    (v_abc, v_abc_disp,  'DISPATCHER'),
    (v_xyz, v_xyz_owner, 'OWNER')
  on conflict (organization_id, user_id) do nothing;

  -- -------------------------------------------------------------------------
  -- ABC Charters — fleet
  -- -------------------------------------------------------------------------
  insert into public.vehicle_types (organization_id, name, description, default_capacity, base_rate, per_km_rate, per_hour_rate)
  values
    (v_abc, 'Highway Coach', 'Reclining 2x2 seating, washroom, Wi-Fi, undercarriage bays',   56, 850, 3.40, 110),
    (v_abc, 'Mini Coach',    'Compact 25-seat coach for city transfers and shuttles',          25, 450, 2.10,  75),
    (v_abc, 'Executive Van', '12-seat van for airport runs and small groups',                  12, 275, 1.60,  55)
  on conflict (organization_id, name) do nothing;

  select id into v_coach   from public.vehicle_types where organization_id = v_abc and name = 'Highway Coach';
  select id into v_minibus from public.vehicle_types where organization_id = v_abc and name = 'Mini Coach';
  select id into v_van     from public.vehicle_types where organization_id = v_abc and name = 'Executive Van';

  insert into public.vehicles (organization_id, vehicle_type_id, name, registration_number, capacity, status, location, year, make, model)
  values
    (v_abc, v_coach,   'Coach 17',   'CV 41017', 56, 'AVAILABLE',   'Etobicoke Garage', 2022, 'MCI',      'J4500'),
    (v_abc, v_coach,   'Coach 21',   'CV 41021', 56, 'AVAILABLE',   'Etobicoke Garage', 2021, 'Prevost',  'H3-45'),
    (v_abc, v_coach,   'Coach 24',   'CV 41024', 54, 'MAINTENANCE', 'Service Bay',      2019, 'MCI',      'D4505'),
    (v_abc, v_minibus, 'Mini 04',    'CV 52004', 25, 'AVAILABLE',   'Etobicoke Garage', 2023, 'Girardin', 'G5'),
    (v_abc, v_minibus, 'Mini 06',    'CV 52006', 25, 'IN_TRIP',     'En route',         2020, 'Girardin', 'G5'),
    (v_abc, v_van,     'Van 02',     'CV 63002', 12, 'AVAILABLE',   'Pearson Lot',      2024, 'Mercedes', 'Sprinter'),
    (v_abc, v_van,     'Van 05',     'CV 63005', 12, 'INACTIVE',    'Etobicoke Garage', 2016, 'Ford',     'Transit')
  on conflict (organization_id, registration_number) do nothing;

  insert into public.vehicle_maintenance (organization_id, vehicle_id, title, description, status, scheduled_at, cost, odometer_km)
  select v_abc, v.id, 'Annual MTO safety inspection', 'Air brake adjustment and rotor inspection', 'IN_PROGRESS',
         now() + interval '1 day', 2450, 662300
  from public.vehicles v
  where v.organization_id = v_abc and v.registration_number = 'CV 41024'
  on conflict do nothing;

  -- -------------------------------------------------------------------------
  -- ABC Charters — drivers
  -- -------------------------------------------------------------------------
  insert into public.drivers (organization_id, first_name, last_name, email, phone, license_number, license_class, air_brake_endorsement, license_expires_on, status)
  values
    (v_abc, 'Daniel',   'Tremblay', 'd.tremblay@mapleleafcoach.test', '+1 416 555 0201', 'T4021-10149-64603', 'ON-C', true,  '2028-04-30', 'ACTIVE'),
    (v_abc, 'Amrit',    'Gill',     'a.gill@mapleleafcoach.test',     '+1 416 555 0202', 'G4021-19912-23307', 'ON-C', true,  '2027-11-15', 'ON_TRIP'),
    (v_abc, 'Marie',    'Beaulieu', 'm.beaulieu@mapleleafcoach.test', '+1 416 555 0203', 'B4021-15566-77811', 'ON-C', true,  '2026-09-01', 'ACTIVE'),
    (v_abc, 'Kwame',    'Osei',     'k.osei@mapleleafcoach.test',     '+1 416 555 0204', 'O4021-13344-55619', 'ON-F', false, '2029-02-20', 'OFF_DUTY'),
    (v_abc, 'Jennifer', 'MacLeod',  'j.macleod@mapleleafcoach.test',  '+1 416 555 0205', 'M4021-17788-99024', 'ON-C', true,  '2027-06-10', 'ON_LEAVE')
  on conflict do nothing;

  -- -------------------------------------------------------------------------
  -- ABC Charters — customers
  -- -------------------------------------------------------------------------
  insert into public.customers (organization_id, first_name, last_name, email, phone, company, notes)
  values
    (v_abc, 'Sarah',  'Johnson',  'sarah@northfield.test',   '+1 416 555 0301', 'Northfield Secondary School', 'Books the Grade 12 Ottawa trip every May.'),
    (v_abc, 'Priya',  'Raman',    'priya@auroratech.test',   '+1 647 555 0302', 'Aurora Technologies',         'Quarterly offsites. Needs the HST number on every invoice.'),
    (v_abc, 'Chantal','Lefebvre', 'chantal@lefebvre.test',   '+1 905 555 0303', 'Lefebvre Wedding Co.',        'Weekend wedding shuttles across the GTA.'),
    (v_abc, 'Tom',    'Alvarez',  'tom@sunburstravel.test',  '+1 289 555 0304', 'Sunburst Travel',             'Cross-border day trips to Buffalo. Passports checked at pickup.')
  on conflict do nothing;

  -- -------------------------------------------------------------------------
  -- ABC Charters — inbound trip requests (Needs Attention on the dashboard)
  -- -------------------------------------------------------------------------
  insert into public.trip_requests (
    organization_id, customer_id, pickup_location, pickup_address, destination, destination_address,
    departure_at, return_at, passenger_count, special_requirements, status, source,
    contact_name, contact_email, contact_phone
  )
  select
    v_abc, c.id, r.pickup, r.pickup_address, r.destination, r.destination_address,
    r.departure_at, r.return_at, r.passengers, r.requirements, r.status::public.trip_request_status,
    r.source::public.trip_request_source, r.contact_name, r.contact_email, r.contact_phone
  from (values
    ('sarah@northfield.test', 'Toronto', 'Northfield Secondary School, 240 Bloor St W, Toronto', 'Ottawa',
     'Canadian Museum of History, 100 Laurier St, Gatineau',
     now() + interval '18 days', now() + interval '20 days', 60,
     E'Two wheelchair users\nUndercarriage space for 60 bags', 'NEW', 'WEBSITE_WIDGET',
     'Sarah Johnson', 'sarah@northfield.test', '+1 416 555 0301'),
    ('priya@auroratech.test', 'Mississauga', 'Aurora Technologies, 2000 Argentia Rd, Mississauga', 'Blue Mountain',
     'Blue Mountain Resort, 190 Gord Canning Dr, The Blue Mountains',
     now() + interval '9 days', now() + interval '11 days', 42,
     'Two rest stops. Wi-Fi preferred. Winter tires required.', 'REVIEWING', 'DASHBOARD',
     'Priya Raman', 'priya@auroratech.test', '+1 647 555 0302'),
    ('chantal@lefebvre.test', 'Hamilton', 'Liuna Station, 360 James St N, Hamilton', 'Niagara Falls',
     'Table Rock Centre, 6650 Niagara Pkwy, Niagara Falls',
     now() + interval '4 days', now() + interval '5 days', 90,
     'Three coaches. Wedding party, decorated.', 'NEEDS_INFORMATION', 'HOSTED_PAGE',
     'Chantal Lefebvre', 'chantal@lefebvre.test', '+1 905 555 0303'),
    ('tom@sunburstravel.test', 'St. Catharines', '1 St. Paul St, St. Catharines', 'Buffalo',
     'Buffalo Niagara International Airport, NY',
     now() + interval '26 days', now() + interval '29 days', 24,
     'Crosses at Peace Bridge. Every passenger carries a passport.', 'NEW', 'API',
     'Tom Alvarez', 'tom@sunburstravel.test', '+1 289 555 0304')
  ) as r(customer_email, pickup, pickup_address, destination, destination_address,
         departure_at, return_at, passengers, requirements, status, source,
         contact_name, contact_email, contact_phone)
  join public.customers c
    on c.organization_id = v_abc and c.email = r.customer_email
  where not exists (
    select 1 from public.trip_requests tr
    where tr.organization_id = v_abc and tr.destination = r.destination
  );

  -- -------------------------------------------------------------------------
  -- Autocars Rivière-Nord — a second tenant, in another province, to prove
  -- isolation. Signed in as the Toronto owner, none of this should be visible.
  -- -------------------------------------------------------------------------
  insert into public.vehicle_types (organization_id, name, description, default_capacity, base_rate, per_km_rate, per_hour_rate)
  values (v_xyz, 'Autocar de tourisme', 'Autocar 54 places, toilettes et Wi-Fi', 54, 900, 3.60, 115)
  on conflict (organization_id, name) do nothing;

  insert into public.vehicles (organization_id, vehicle_type_id, name, registration_number, capacity, status, location, year, make, model)
  select v_xyz, vt.id, 'Autocar 01', 'L12 3QC', 54, 'AVAILABLE', 'Garage Lachine', 2023, 'Prevost', 'X3-45'
  from public.vehicle_types vt
  where vt.organization_id = v_xyz and vt.name = 'Autocar de tourisme'
  on conflict (organization_id, registration_number) do nothing;

  insert into public.drivers (organization_id, first_name, last_name, email, phone, license_number, license_class, air_brake_endorsement, status)
  values (v_xyz, 'Étienne', 'Roy', 'e.roy@rivierenord.test', '+1 514 555 0401', 'R2201-19988-77602', 'QC-2', true, 'ACTIVE')
  on conflict do nothing;

  insert into public.customers (organization_id, first_name, last_name, email, phone, company)
  values (v_xyz, 'Lena', 'Fischer', 'lena@harbourgroup.test', '+1 450 555 0402', 'Harbour Group')
  on conflict do nothing;

  -- -------------------------------------------------------------------------
  -- Quote builder support: daily rates, garages, contract terms
  -- -------------------------------------------------------------------------
  update public.vehicle_types set per_day_rate = case name
    when 'Highway Coach' then 1650
    when 'Mini Coach'    then 950
    when 'Executive Van' then 650
    else per_day_rate end
  where organization_id = v_abc;

  update public.vehicle_types set per_day_rate = 1750
  where organization_id = v_xyz and name = 'Autocar de tourisme';

  insert into public.garages (organization_id, name, address, city, province, postal_code, is_default)
  values
    (v_abc, 'Etobicoke Garage', '480 Carlingview Drive', 'Toronto', 'ON', 'M9W 5G6', true),
    (v_abc, 'Pearson Lot',      '6301 Silver Dart Drive', 'Mississauga', 'ON', 'L5P 1B2', false),
    (v_xyz, 'Garage Lachine',   '1250 rue Notre-Dame Ouest', 'Montréal', 'QC', 'H3C 1K5', true)
  on conflict (organization_id, name) do nothing;

  insert into public.contract_terms (organization_id, name, body, is_default)
  values
    (v_abc, 'Standard Charter Agreement',
     E'1. A deposit confirms the reservation. The balance is due 14 days before departure.\n'
     '2. Cancellations inside 14 days forfeit the deposit; inside 72 hours are billed in full.\n'
     '3. Quoted distances and hours are estimates. Overage is billed at the rate on this quote.\n'
     '4. The operator carries $5,000,000 commercial liability insurance. A certificate is available on request.\n'
     '5. Passengers are responsible for any damage beyond normal wear. Smoking is not permitted on board.',
     true),
    (v_xyz, 'Entente de nolisement standard',
     E'1. Un acompte confirme la réservation. Le solde est dû 14 jours avant le départ.\n'
     '2. Toute annulation dans les 14 jours entraîne la perte de l''acompte.\n'
     '3. Les distances et heures indiquées sont estimatives.',
     true)
  -- Terms are unique per (organization, kind, name): the settings migration
  -- split contract terms from quote terms, and an operator may reasonably give
  -- both the same name.
  on conflict (organization_id, kind, name) do nothing;
end;
$$;
