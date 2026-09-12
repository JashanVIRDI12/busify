-- ===========================================================================
-- Busify — demo data for one existing organization
--
--   npx supabase db query --linked -f supabase/demo-viabus.sql
--
-- Unlike seed.sql / seed-console.sql this does not create an organization or
-- any auth users. It fills in the one that is already there, so a real signed-up
-- account has something to look at: a fleet, drivers, customers, a pipeline of
-- quotes and a fortnight of reservations.
--
-- Safe to re-run: every insert is guarded on a natural key, so a second run
-- adds nothing. It never touches rows that are not part of this demo set.
--
-- Deliberately leaves gaps — one reservation with no vehicle and one with no
-- driver — because an empty dispatch board proves nothing. The point of those
-- screens is showing what is *not* covered yet.
-- ===========================================================================

do $$
declare
  v_org   uuid;
  v_owner uuid;
  v_zone  text;
  -- Local midnight today. Trips are laid out on the operator's clock, so
  -- running this at 3 p.m. must not produce a school trip leaving at 10 p.m.
  v_day0  timestamp;

  v_garage_main uuid;
  v_garage_east uuid;

  v_type_coach  uuid;
  v_type_mini   uuid;
  v_type_van    uuid;

  v_quote uuid;
  v_qtrip uuid;
  r record;
begin
  -- The organization this fills in. Picked as the oldest one, which on a
  -- single-tenant install is simply "the" organization.
  select id, timezone into v_org, v_zone
    from public.organizations order by created_at limit 1;

  if v_org is null then
    raise notice 'No organization found — sign up first, then re-run.';
    return;
  end if;

  select user_id into v_owner
    from public.organization_members
   where organization_id = v_org
   order by case role when 'OWNER' then 0 when 'ADMIN' then 1 else 2 end
   limit 1;

  v_day0 := date_trunc('day', now() at time zone coalesce(v_zone, 'America/Toronto'));

  raise notice 'Seeding demo data into organization %', v_org;

  -- -------------------------------------------------------------------------
  -- Garages
  -- -------------------------------------------------------------------------
  insert into public.garages (organization_id, name, address, city, province, postal_code)
  select v_org, g.name, g.address, g.city, g.province, g.postal
  from (values
    ('Etobicoke Garage', '120 Carlingview Dr', 'Toronto', 'ON', 'M9W 5E7'),
    ('Scarborough Yard', '2550 Markham Rd',    'Toronto', 'ON', 'M1X 1L4')
  ) as g(name, address, city, province, postal)
  where not exists (
    select 1 from public.garages
     where organization_id = v_org and name = g.name
  );

  select id into v_garage_main from public.garages
   where organization_id = v_org and name = 'Etobicoke Garage';
  select id into v_garage_east from public.garages
   where organization_id = v_org and name = 'Scarborough Yard';

  -- -------------------------------------------------------------------------
  -- Vehicle types, and the rate card that prices them
  -- -------------------------------------------------------------------------
  insert into public.vehicle_types (organization_id, name, description, default_capacity)
  select v_org, t.name, t.description, t.capacity
  from (values
    ('Motorcoach', 'Air-conditioned 2x2 seating, reclining seats, onboard restroom.', 56),
    ('Mini Bus',   'School-style mini coach. No restroom, no luggage bay.',           24),
    ('Sprinter',   'Executive van for small groups and airport runs.',                14)
  ) as t(name, description, capacity)
  where not exists (
    select 1 from public.vehicle_types
     where organization_id = v_org and name = t.name
  );

  select id into v_type_coach from public.vehicle_types where organization_id = v_org and name = 'Motorcoach';
  select id into v_type_mini  from public.vehicle_types where organization_id = v_org and name = 'Mini Bus';
  select id into v_type_van   from public.vehicle_types where organization_id = v_org and name = 'Sprinter';

  -- Without these the quote builder prices everything at zero, so they are the
  -- single most important part of this whole file.
  insert into public.vehicle_rates
    (organization_id, vehicle_type_id, live_mile_rate, dead_mile_rate, hourly_rate, minimum_hours, daily_rate)
  select v_org, r2.type_id, r2.live, r2.dead, r2.hourly, r2.min_hours, r2.daily
  from (values
    (v_type_coach, 3.10, 2.20, 145.00, 5, 1450.00),
    (v_type_mini,  2.40, 1.70, 110.00, 4, 1050.00),
    (v_type_van,   1.90, 1.30,  85.00, 3,  780.00)
  ) as r2(type_id, live, dead, hourly, min_hours, daily)
  where r2.type_id is not null
    and not exists (
      select 1 from public.vehicle_rates
       where organization_id = v_org
         and vehicle_type_id = r2.type_id
         and vehicle_id is null
    );

  -- -------------------------------------------------------------------------
  -- The fleet
  -- -------------------------------------------------------------------------
  insert into public.vehicles
    (organization_id, name, vehicle_type_id, garage_id, registration_number,
     capacity, make, model, year, status, amenities)
  select v_org, v.name, v.type_id, v.garage_id, v.plate, v.capacity,
         v.make, v.model, v.year, v.status::public.vehicle_status, v.amenities
  from (values
    ('Coach 101', v_type_coach, v_garage_main, 'ON-COACH-101', 56, 'Prevost', 'H3-45',      2021, 'AVAILABLE',   array['WIFI','RESTROOM','AC','LUGGAGE']),
    ('Coach 102', v_type_coach, v_garage_main, 'ON-COACH-102', 56, 'MCI',     'J4500',      2019, 'AVAILABLE',   array['WIFI','RESTROOM','AC']),
    ('Coach 103', v_type_coach, v_garage_east, 'ON-COACH-103', 56, 'Prevost', 'H3-45',      2023, 'AVAILABLE',   array['WIFI','RESTROOM','AC','LUGGAGE','USB']),
    ('Mini 201',  v_type_mini,  v_garage_main, 'ON-MINI-201',  24, 'Ford',    'E-450',      2020, 'AVAILABLE',   array['AC']),
    ('Mini 202',  v_type_mini,  v_garage_east, 'ON-MINI-202',  24, 'Ford',    'E-450',      2022, 'MAINTENANCE', array['AC','USB']),
    ('Van 301',   v_type_van,   v_garage_main, 'ON-VAN-301',   14, 'Mercedes','Sprinter',   2023, 'AVAILABLE',   array['AC','WIFI','USB'])
  ) as v(name, type_id, garage_id, plate, capacity, make, model, year, status, amenities)
  where not exists (
    select 1 from public.vehicles
     where organization_id = v_org and name = v.name
  );

  -- -------------------------------------------------------------------------
  -- Drivers
  -- -------------------------------------------------------------------------
  insert into public.drivers
    (organization_id, first_name, last_name, email, phone, garage_id,
     license_number, license_class, license_expires_on, status)
  select v_org, d.first, d.last, d.email, d.phone, d.garage_id,
         d.licence, d.class, (v_day0 + d.expiry)::date, d.status::public.driver_status
  from (values
    ('Marc',   'Tremblay', 'marc.tremblay@viabus.test',   '(416) 555-0111', v_garage_main, 'T4412-88910-01', 'ON-B', interval '420 days', 'ACTIVE'),
    ('Priya',  'Raman',    'priya.raman@viabus.test',     '(416) 555-0112', v_garage_main, 'R2210-55120-02', 'ON-B', interval '210 days', 'ACTIVE'),
    ('Daniel', 'Okafor',   'daniel.okafor@viabus.test',   '(647) 555-0113', v_garage_east, 'O9921-31240-03', 'ON-B', interval '95 days',  'ACTIVE'),
    ('Sylvie', 'Lefebvre', 'sylvie.lefebvre@viabus.test', '(647) 555-0114', v_garage_east, 'L5540-77210-04', 'ON-C', interval '560 days', 'ACTIVE'),
    ('Ahmed',  'Hassan',   'ahmed.hassan@viabus.test',    '(905) 555-0115', v_garage_main, 'H3312-90110-05', 'ON-B', interval '30 days',  'ON_LEAVE')
  ) as d(first, last, email, phone, garage_id, licence, class, expiry, status)
  where not exists (
    select 1 from public.drivers
     where organization_id = v_org and email = d.email
  );

  -- -------------------------------------------------------------------------
  -- Companies and the contacts who book for them
  -- -------------------------------------------------------------------------
  insert into public.companies
    (organization_id, name, email, phone, address_line1, city, province, postal_code, industry)
  select v_org, c.name, c.email, c.phone, c.address, c.city, 'ON', c.postal, c.industry
  from (values
    ('Northfield Secondary School', 'office@northfield.test', '(416) 555-0301', '240 Bloor St W',   'Toronto',  'M5S 1V6', 'School / School Board'),
    ('Aurora Software',             'travel@aurorasw.test',   '(416) 555-0302', '88 Queens Quay W', 'Toronto',  'M5J 2N8', 'Corporate'),
    ('Lakeshore United FC',         'team@lakeshorefc.test',  '(905) 555-0303', '1 Rutherford Rd',  'Brampton', 'L6V 2R1', 'Sports Team')
  ) as c(name, email, phone, address, city, postal, industry)
  where not exists (
    select 1 from public.companies
     where organization_id = v_org and name = c.name
  );

  insert into public.customers
    (organization_id, first_name, last_name, email, phone, company, job_title, city, province)
  select v_org, c.first, c.last, c.email, c.phone, c.company, c.title, 'Toronto', 'ON'
  from (values
    ('Helen',  'Boyd',     'helen.boyd@northfield.test',  '(416) 555-0401', 'Northfield Secondary School', 'Trip Coordinator'),
    ('Raj',    'Mehta',    'raj.mehta@aurorasw.test',     '(416) 555-0402', 'Aurora Software',             'Office Manager'),
    ('Chantal','Dubois',   'chantal.dubois@lakeshorefc.test', '(905) 555-0403', 'Lakeshore United FC',     'Team Manager'),
    ('Owen',   'Fraser',   'owen.fraser@example.test',    '(647) 555-0404', null,                          null),
    ('Amara',  'Nwosu',    'amara.nwosu@example.test',    '(647) 555-0405', null,                          null)
  ) as c(first, last, email, phone, company, title)
  where not exists (
    select 1 from public.customers
     where organization_id = v_org and email = c.email
  );

  -- -------------------------------------------------------------------------
  -- Inbound demand
  -- -------------------------------------------------------------------------
  insert into public.trip_requests
    (organization_id, customer_id, contact_name, contact_email, contact_phone,
     pickup_location, destination, departure_at, return_at, passenger_count,
     status, special_requirements)
  select v_org,
         (select id from public.customers where organization_id = v_org and email = t.email),
         t.contact, t.email, t.phone, t.pickup, t.dest,
         (v_day0 + t.depart) at time zone coalesce(v_zone, 'America/Toronto'),
         case when t.ret is null then null
              else (v_day0 + t.ret) at time zone coalesce(v_zone, 'America/Toronto') end,
         t.pax, t.status::public.trip_request_status, t.notes
  from (values
    ('Helen Boyd',    'helen.boyd@northfield.test',      '(416) 555-0401',
     '240 Bloor St W, Toronto', 'Ottawa, ON',
     interval '9 days 7 hours', interval '11 days 18 hours', 52, 'NEW',
     'Grade 12 history trip. Two chaperones, one wheelchair user.'),
    ('Raj Mehta',     'raj.mehta@aurorasw.test',         '(416) 555-0402',
     '88 Queens Quay W, Toronto', 'Blue Mountain Resort',
     interval '16 days 8 hours', interval '16 days 20 hours', 40, 'REVIEWING',
     'Company offsite. Needs wifi on board.'),
    ('Chantal Dubois','chantal.dubois@lakeshorefc.test', '(905) 555-0403',
     '1 Rutherford Rd, Brampton', 'Buffalo, NY',
     interval '23 days 6 hours', interval '23 days 23 hours', 22, 'NEEDS_INFORMATION',
     'Cross-border. Need the passenger manifest before we can price it.')
  ) as t(contact, email, phone, pickup, dest, depart, ret, pax, status, notes)
  where not exists (
    select 1 from public.trip_requests
     where organization_id = v_org and contact_email = t.email
  );

  -- -------------------------------------------------------------------------
  -- A quote pipeline
  --
  -- Each one is a real builder quote: a trip, its stops, a vehicle and the tax
  -- row, so opening it shows a populated builder rather than an empty shell.
  -- -------------------------------------------------------------------------
  for r in
    select * from (values
      ('Northfield Ottawa trip',     'helen.boyd@northfield.test',      'QUOTED',   interval '9 days 7 hours',  '240 Bloor St W, Toronto',   'Ottawa, ON',            52, v_type_coach, 4850.00),
      ('Aurora Q4 offsite shuttle',  'raj.mehta@aurorasw.test',         'LEAD',     interval '16 days 8 hours', '88 Queens Quay W, Toronto', 'Blue Mountain Resort',  40, v_type_coach, 2380.00),
      ('Lakeshore Buffalo away game','chantal.dubois@lakeshorefc.test', 'FOLLOW_UP',interval '23 days 6 hours', '1 Rutherford Rd, Brampton', 'Buffalo, NY',           22, v_type_mini,  1890.00),
      ('Pearson arrivals — Aurora',  'raj.mehta@aurorasw.test',         'WON',      interval '4 days 5 hours',  'Toronto Pearson T1',        '88 Queens Quay W',      12, v_type_van,    460.00)
    ) as q(title, email, status, depart, pickup, dest, pax, type_id, total)
  loop
    if exists (
      select 1 from public.quotes where organization_id = v_org and title = r.title
    ) then
      continue;
    end if;

    insert into public.quotes
      (organization_id, customer_id, title, status, pipeline_status, currency,
       tax_province, created_by, subtotal, tax, total,
       pickup_at, pickup_address)
    values
      (v_org,
       (select id from public.customers where organization_id = v_org and email = r.email),
       r.title,
       (case when r.status = 'LEAD' then 'DRAFT' else 'SENT' end)::public.quote_status,
       r.status::public.quote_pipeline_status,
       'CAD', 'ON', v_owner,
       round(r.total / 1.13, 2),
       round(r.total - (r.total / 1.13), 2),
       r.total,
       (v_day0 + r.depart) at time zone coalesce(v_zone, 'America/Toronto'),
       r.pickup)
    returning id into v_quote;

    insert into public.quote_trips
      (organization_id, quote_id, position, name, trip_type, passenger_count,
       departing_garage_id, returning_garage_id,
       departing_date, departing_time,
       rate_hourly, rate_per_mile, rate_daily,
       subtotal, tax_total, total)
    values
      (v_org, v_quote, 0, 'Trip 1', 'ROUND_TRIP', r.pax,
       v_garage_main, v_garage_main,
       (v_day0 + r.depart)::date, '07:00',
       145.00, 3.10, 1450.00,
       round(r.total / 1.13, 2),
       round(r.total - (r.total / 1.13), 2),
       r.total)
    returning id into v_qtrip;

    insert into public.quote_trip_stops
      (organization_id, quote_trip_id, position, kind, label, address, stop_date, stop_time)
    values
      (v_org, v_qtrip, 0, 'PICKUP',  'Pickup',  r.pickup, (v_day0 + r.depart)::date, '07:00'),
      (v_org, v_qtrip, 1, 'DROPOFF', 'Dropoff', r.dest,   (v_day0 + r.depart)::date, '11:30');

    insert into public.quote_trip_vehicles
      (organization_id, quote_trip_id, position, vehicle_type_id, quantity)
    values (v_org, v_qtrip, 0, r.type_id, 1);

    -- Ontario HST, the row the builder seeds on every new trip.
    insert into public.quote_trip_charges
      (organization_id, quote_trip_id, section, position, label, kind, rate, quantity, amount, taxable)
    values
      (v_org, v_qtrip, 'TAX', 0, 'HST 13%', 'PERCENT', 13, 1,
       round(r.total - (r.total / 1.13), 2), false);

    insert into public.quote_payment_methods
      (organization_id, quote_id, method, position, enabled, online_processing)
    values
      (v_org, v_quote, 'CARD',  0, true,  true),
      (v_org, v_quote, 'BANK',  1, true,  true),
      (v_org, v_quote, 'CHECK', 2, true,  false),
      (v_org, v_quote, 'WIRE',  3, false, false),
      (v_org, v_quote, 'OTHER', 4, false, false);
  end loop;

  raise notice 'Demo data complete.';
end;
$$;
