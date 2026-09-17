-- ===========================================================================
-- Busify — demo data for one existing organization
--
--   npx supabase db query --linked -f supabase/demo-viabus.sql
--
-- Unlike seed.sql / seed-console.sql this creates no organization and no auth
-- users. It fills in the one that is already there, so a real signed-up account
-- has something to show a customer: a fleet, drivers, contacts, a priced quote
-- pipeline and a fortnight of reservations with money against them.
--
-- Safe to re-run: every insert is guarded on a natural key, so a second run
-- adds nothing.
--
-- Deliberately leaves gaps — a reservation with no vehicle, one with no driver,
-- a coach in maintenance, a licence expiring inside 30 days. An empty dispatch
-- board proves nothing; the point of those screens is showing what is *not*
-- covered yet.
-- ===========================================================================

do $$
declare
  -- The organization this fills. A dedicated demo tenant by default, so a real
  -- operator's live data is never touched by a re-run. Falls back to the only
  -- organization present, which is what a fresh install wants.
  v_org_name constant text := 'Via Bus Demo';

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

  -- Pricing, recomputed here exactly as lib/pricing/quote.ts does it, so the
  -- stored totals agree with what the builder shows when the quote is opened.
  v_base     numeric(12,2);
  v_items    numeric(12,2);
  v_subtotal numeric(12,2);
  v_tax      numeric(12,2);
  v_total    numeric(12,2);

  v_trip    uuid;
  v_vehicle uuid;
  v_driver  uuid;
  r record;
begin
  select id, timezone into v_org, v_zone
    from public.organizations where name = v_org_name;

  if v_org is null then
    select id, timezone into v_org, v_zone
      from public.organizations order by created_at limit 1;
  end if;

  if v_org is null then
    raise notice 'No organization found — run demo-org.sql first.';
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
  -- Clear the scratch rows left behind while clicking around
  --
  -- Only quotes with no customer, no title of their own and nothing priced —
  -- which is exactly what the old "Add Quote" button used to create on click.
  -- Anything an operator actually typed into is left alone.
  -- -------------------------------------------------------------------------
  delete from public.quotes
   where organization_id = v_org
     and customer_id is null
     and coalesce(total, 0) = 0
     and coalesce(nullif(btrim(title), ''), 'New Quote') = 'New Quote';

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
    select 1 from public.garages where organization_id = v_org and name = g.name
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
    select 1 from public.vehicle_types where organization_id = v_org and name = t.name
  );

  select id into v_type_coach from public.vehicle_types where organization_id = v_org and name = 'Motorcoach';
  select id into v_type_mini  from public.vehicle_types where organization_id = v_org and name = 'Mini Bus';
  select id into v_type_van   from public.vehicle_types where organization_id = v_org and name = 'Sprinter';

  -- Without these the quote builder prices everything at zero, so they are the
  -- single most important part of this whole file.
  --
  -- Creating a vehicle type fires a trigger that lays down a default rate row
  -- of zeros (20260910120000_seed_defaults_for_new_rows). So these have to be
  -- filled in, not inserted beside — a guarded insert matches that zero row and
  -- silently does nothing, which is exactly how every demo quote came out
  -- priced at the tax on its extras and nothing else.
  --
  -- Only all-zero rows are touched, so a rate an operator has actually set is
  -- never overwritten by a re-run.
  update public.vehicle_rates vr
     set live_mile_rate = x.live,
         dead_mile_rate = x.dead,
         hourly_rate    = x.hourly,
         minimum_hours  = x.min_hours,
         daily_rate     = x.daily
    from (values
      (v_type_coach, 3.10, 2.20, 145.00, 5, 1450.00),
      (v_type_mini,  2.40, 1.70, 110.00, 4, 1050.00),
      (v_type_van,   1.90, 1.30,  85.00, 3,  780.00)
    ) as x(type_id, live, dead, hourly, min_hours, daily)
   where vr.organization_id = v_org
     and vr.vehicle_type_id = x.type_id
     and vr.vehicle_id is null
     and vr.daily_rate = 0
     and vr.hourly_rate = 0
     and vr.live_mile_rate = 0;

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
       where organization_id = v_org and vehicle_type_id = r2.type_id and vehicle_id is null
    );

  -- Charges an operator can drop onto any quote, plus one that lands on every
  -- new quote automatically.
  insert into public.custom_charges
    (organization_id, category, name, rate_type, rate, tax_exempt, default_on_quote, placement, position)
  select v_org, 'CHARGE'::public.charge_category, c.name,
         c.rate_type::public.charge_rate_type, c.rate, c.exempt, c.default_on,
         c.placement::public.charge_placement, c.pos
  from (values
    ('Fuel surcharge',       'PERCENTAGE',  15.50,  false, true,  'ITEMIZED', 0),
    ('Driver accommodation', 'FLAT',       250.00,  false, false, 'ITEMIZED', 1),
    ('Tolls and parking',    'FLAT',        45.00,  false, false, 'ITEMIZED', 2),
    ('Cross-border fee',     'FLAT',       180.00,  false, false, 'ITEMIZED', 3)
  ) as c(name, rate_type, rate, exempt, default_on, placement, pos)
  where not exists (
    select 1 from public.custom_charges where organization_id = v_org and name = c.name
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
    ('Coach 101', v_type_coach, v_garage_main, 'ON-COACH-101', 56, 'Prevost', 'H3-45',    2021, 'AVAILABLE',   array['WIFI','RESTROOM','AC','LUGGAGE']),
    ('Coach 102', v_type_coach, v_garage_main, 'ON-COACH-102', 56, 'MCI',     'J4500',    2019, 'AVAILABLE',   array['WIFI','RESTROOM','AC']),
    ('Coach 103', v_type_coach, v_garage_east, 'ON-COACH-103', 56, 'Prevost', 'H3-45',    2023, 'AVAILABLE',   array['WIFI','RESTROOM','AC','LUGGAGE','USB']),
    ('Mini 201',  v_type_mini,  v_garage_main, 'ON-MINI-201',  24, 'Ford',    'E-450',    2020, 'AVAILABLE',   array['AC']),
    ('Mini 202',  v_type_mini,  v_garage_east, 'ON-MINI-202',  24, 'Ford',    'E-450',    2022, 'MAINTENANCE', array['AC','USB']),
    ('Van 301',   v_type_van,   v_garage_main, 'ON-VAN-301',   14, 'Mercedes','Sprinter', 2023, 'AVAILABLE',   array['AC','WIFI','USB'])
  ) as v(name, type_id, garage_id, plate, capacity, make, model, year, status, amenities)
  where not exists (
    select 1 from public.vehicles where organization_id = v_org and name = v.name
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
    select 1 from public.drivers where organization_id = v_org and email = d.email
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
    select 1 from public.companies where organization_id = v_org and name = c.name
  );

  insert into public.customers
    (organization_id, first_name, last_name, email, phone, company, job_title, city, province)
  select v_org, c.first, c.last, c.email, c.phone, c.company, c.title, 'Toronto', 'ON'
  from (values
    ('Helen',   'Boyd',   'helen.boyd@northfield.test',      '(416) 555-0401', 'Northfield Secondary School', 'Trip Coordinator'),
    ('Raj',     'Mehta',  'raj.mehta@aurorasw.test',         '(416) 555-0402', 'Aurora Software',             'Office Manager'),
    ('Chantal', 'Dubois', 'chantal.dubois@lakeshorefc.test', '(905) 555-0403', 'Lakeshore United FC',         'Team Manager'),
    ('Owen',    'Fraser', 'owen.fraser@example.test',        '(647) 555-0404', null,                          null),
    ('Amara',   'Nwosu',  'amara.nwosu@example.test',        '(647) 555-0405', null,                          null)
  ) as c(first, last, email, phone, company, title)
  where not exists (
    select 1 from public.customers where organization_id = v_org and email = c.email
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
    ('Helen Boyd',     'helen.boyd@northfield.test',      '(416) 555-0401',
     '240 Bloor St W, Toronto', 'Ottawa, ON',
     interval '9 days 7 hours', interval '11 days 18 hours', 52, 'NEW',
     'Grade 12 history trip. Two chaperones, one wheelchair user.'),
    ('Raj Mehta',      'raj.mehta@aurorasw.test',         '(416) 555-0402',
     '88 Queens Quay W, Toronto', 'Blue Mountain Resort',
     interval '16 days 8 hours', interval '16 days 20 hours', 40, 'REVIEWING',
     'Company offsite. Needs wifi on board.'),
    ('Chantal Dubois', 'chantal.dubois@lakeshorefc.test', '(905) 555-0403',
     '1 Rutherford Rd, Brampton', 'Buffalo, NY',
     interval '23 days 6 hours', interval '23 days 23 hours', 22, 'NEEDS_INFORMATION',
     'Cross-border. Need the passenger manifest before we can price it.')
  ) as t(contact, email, phone, pickup, dest, depart, ret, pax, status, notes)
  where not exists (
    select 1 from public.trip_requests where organization_id = v_org and contact_email = t.email
  );

  -- -------------------------------------------------------------------------
  -- A priced quote pipeline
  --
  -- Each quote is a real builder quote: a trip with days/hours/distance and a
  -- rate card behind it, itemised charges, and the tax row. The base fare is
  -- computed the way the engine computes it — the highest of daily, hourly and
  -- per-kilometre — so opening one shows a populated Pricing tab whose numbers
  -- add up rather than a total pasted over an empty breakdown.
  -- -------------------------------------------------------------------------
  for r in
    select * from (values
      -- title, contact, pipeline, depart, pickup, dest, pax, type, days, hours, km, itemised
      ('Northfield Ottawa trip',      'helen.boyd@northfield.test',      'QUOTED',    interval '9 days 7 hours',  '240 Bloor St W, Toronto',   'Ottawa, ON',           52, v_type_coach, 3, 26, 900.0, 295.00),
      ('Aurora Q4 offsite shuttle',   'raj.mehta@aurorasw.test',         'LEAD',      interval '16 days 8 hours', '88 Queens Quay W, Toronto', 'Blue Mountain Resort', 40, v_type_coach, 1, 12, 420.0,  45.00),
      ('Lakeshore Buffalo away game', 'chantal.dubois@lakeshorefc.test', 'FOLLOW_UP', interval '23 days 6 hours', '1 Rutherford Rd, Brampton', 'Buffalo, NY',          22, v_type_mini,  1, 17, 340.0, 225.00),
      ('Pearson arrivals — Aurora',   'raj.mehta@aurorasw.test',         'WON',       interval '4 days 5 hours',  'Toronto Pearson T1',        '88 Queens Quay W',     12, v_type_van,   1,  4,  55.0,   0.00)
    ) as q(title, email, pipeline, depart, pickup, dest, pax, type_id, days, hours, km, items)
  loop
    if exists (select 1 from public.quotes where organization_id = v_org and title = r.title) then
      continue;
    end if;

    -- The rate card for the type this quote is built around.
    select
      greatest(
        coalesce(vr.daily_rate, 0)     * r.days,
        coalesce(vr.hourly_rate, 0)    * r.hours,
        coalesce(vr.live_mile_rate, 0) * r.km,
        0
      )
      into v_base
      from public.vehicle_rates vr
     where vr.organization_id = v_org
       and vr.vehicle_type_id = r.type_id
       and vr.vehicle_id is null;

    v_base     := round(coalesce(v_base, 0), 2);
    v_items    := r.items;
    v_subtotal := round(v_base + v_items, 2);
    v_tax      := round(v_subtotal * 0.13, 2);
    v_total    := round(v_subtotal + v_tax, 2);

    insert into public.quotes
      (organization_id, customer_id, title, status, pipeline_status, currency,
       tax_province, tax_rate_percent, created_by, subtotal, tax, total,
       pickup_at, pickup_address, sent_at)
    values
      (v_org,
       (select id from public.customers where organization_id = v_org and email = r.email),
       r.title,
       (case when r.pipeline = 'LEAD' then 'DRAFT' else 'SENT' end)::public.quote_status,
       r.pipeline::public.quote_pipeline_status,
       'CAD', 'ON', 13, v_owner,
       v_subtotal, v_tax, v_total,
       (v_day0 + r.depart) at time zone coalesce(v_zone, 'America/Toronto'),
       r.pickup,
       case when r.pipeline = 'LEAD' then null else now() - interval '2 days' end)
    returning id into v_quote;

    insert into public.quote_trips
      (organization_id, quote_id, position, name, trip_type, passenger_count, driver_count,
       departing_garage_id, returning_garage_id, departing_date, departing_time,
       base_fare_mode, rate_daily, rate_hourly, rate_per_mile, rate_flat_base,
       days, hours, total_miles, live_miles, dead_miles, estimated_minutes,
       base_fare_total, subtotal, tax_total, total)
    select
      v_org, v_quote, 0, 'Trip 1', 'ROUND_TRIP', r.pax, 1,
      v_garage_main, v_garage_main, (v_day0 + r.depart)::date, '07:00',
      'HIGHEST',
      coalesce(vr.daily_rate, 0), coalesce(vr.hourly_rate, 0),
      coalesce(vr.live_mile_rate, 0), 0,
      r.days, r.hours, r.km, round(r.km * 0.88, 2), round(r.km * 0.12, 2),
      r.hours * 60,
      v_base, v_subtotal, v_tax, v_total
      from public.vehicle_rates vr
     where vr.organization_id = v_org
       and vr.vehicle_type_id = r.type_id
       and vr.vehicle_id is null
    returning id into v_qtrip;

    insert into public.quote_trip_stops
      (organization_id, quote_trip_id, position, kind, label, address, stop_date, stop_time, leg_miles, leg_minutes)
    values
      (v_org, v_qtrip, 0, 'PICKUP',  'Pickup',  r.pickup, (v_day0 + r.depart)::date, '07:00', round(r.km * 0.12, 2), round(r.hours * 6)),
      (v_org, v_qtrip, 1, 'DROPOFF', 'Dropoff', r.dest,   (v_day0 + r.depart)::date, '11:30', round(r.km * 0.88, 2), round(r.hours * 54));

    insert into public.quote_trip_vehicles
      (organization_id, quote_trip_id, position, vehicle_type_id, quantity)
    values (v_org, v_qtrip, 0, r.type_id, 1);

    -- Itemised extras, then the Ontario HST row the builder seeds on every trip.
    if r.items > 0 then
      insert into public.quote_trip_charges
        (organization_id, quote_trip_id, section, position, label, kind, rate, quantity, amount, taxable)
      values
        (v_org, v_qtrip, 'ITEMIZED', 0,
         case when r.items >= 250 then 'Driver accommodation' else 'Tolls and parking' end,
         'FLAT', r.items, 1, r.items, true);
    end if;

    insert into public.quote_trip_charges
      (organization_id, quote_trip_id, section, position, label, kind, rate, quantity, amount, taxable)
    values (v_org, v_qtrip, 'TAX', 0, 'HST 13%', 'PERCENT', 13, 1, v_tax, false);

    insert into public.quote_payment_methods
      (organization_id, quote_id, method, position, enabled, online_processing)
    values
      (v_org, v_quote, 'CARD',  0, true,  true),
      (v_org, v_quote, 'BANK',  1, true,  true),
      (v_org, v_quote, 'CHECK', 2, true,  false),
      (v_org, v_quote, 'WIRE',  3, false, false),
      (v_org, v_quote, 'OTHER', 4, false, false);
  end loop;

  -- -------------------------------------------------------------------------
  -- Reservations — confirmed work, so Dispatch and Payments have something
  --
  -- Inserted one at a time because app.assign_trip_reference() numbers each row
  -- by counting the siblings already present; a batch insert would see zero
  -- siblings for every row and hand them all the same number.
  -- -------------------------------------------------------------------------
  for r in
    select * from (values
      ('Grade 11 Science Centre',  'helen.boyd@northfield.test',      '240 Bloor St W, Toronto',   'Ontario Science Centre', interval '2 days 8 hours',  interval '2 days 16 hours', 48, 'CONFIRMED',  1680.00, 1680.00, 'PAID',    'Coach 101', 'marc.tremblay@viabus.test'),
      ('Aurora airport run',       'raj.mehta@aurorasw.test',         '88 Queens Quay W, Toronto', 'Toronto Pearson T1',     interval '3 days 5 hours',  null,                        12, 'CONFIRMED',   540.00,  270.00, 'PARTIAL', 'Van 301',   'priya.raman@viabus.test'),
      ('Lakeshore home fixture',   'chantal.dubois@lakeshorefc.test', '1 Rutherford Rd, Brampton', 'BMO Field, Toronto',     interval '5 days 9 hours',  interval '5 days 18 hours', 22, 'SCHEDULED',  1120.00,    0.00, 'UNPAID',  'Mini 201',  null),
      ('Northfield Ottawa trip',   'helen.boyd@northfield.test',      '240 Bloor St W, Toronto',   'Ottawa, ON',             interval '9 days 7 hours',  interval '11 days 18 hours',52, 'SCHEDULED',  5243.20, 1500.00, 'PARTIAL', null,        'daniel.okafor@viabus.test'),
      ('Amara wedding shuttle',    'amara.nwosu@example.test',        'Casa Loma, Toronto',        'Liberty Grand, Toronto', interval '12 days 15 hours',interval '12 days 23 hours',36, 'SCHEDULED',   980.00,    0.00, 'UNPAID',  null,        null),
      ('Owen golf outing',         'owen.fraser@example.test',        'Etobicoke Garage',          'Glen Abbey, Oakville',   interval '-6 days 7 hours', interval '-6 days 19 hours',18, 'COMPLETED',   860.00,  860.00, 'PAID',    'Mini 201',  'sylvie.lefebvre@viabus.test')
    ) as t(group_name, email, pickup, dest, depart, ret, pax, status, due, paid, pay_status, vehicle, driver)
  loop
    if exists (
      select 1 from public.trips where organization_id = v_org and group_name = r.group_name
    ) then
      continue;
    end if;

    insert into public.trips
      (organization_id, customer_id, group_name, pickup_location, destination,
       departure_at, return_at, passenger_count, status, garage_id,
       total_due, amount_paid, payment_status, created_by)
    values
      (v_org,
       (select id from public.customers where organization_id = v_org and email = r.email),
       r.group_name, r.pickup, r.dest,
       (v_day0 + r.depart) at time zone coalesce(v_zone, 'America/Toronto'),
       case when r.ret is null then null
            else (v_day0 + r.ret) at time zone coalesce(v_zone, 'America/Toronto') end,
       r.pax, r.status::public.trip_status, v_garage_main,
       r.due, r.paid, r.pay_status::public.reservation_payment_status, v_owner)
    returning id into v_trip;

    select id into v_vehicle from public.vehicles
     where organization_id = v_org and name = r.vehicle;
    select id into v_driver from public.drivers
     where organization_id = v_org and email = r.driver;

    -- A reservation with no coach and one with no driver are left deliberately:
    -- the dispatch board exists to show what is still uncovered.
    if v_vehicle is not null or v_driver is not null then
      insert into public.trip_assignments
        (organization_id, trip_id, vehicle_id, driver_id)
      values (v_org, v_trip, v_vehicle, v_driver);
    end if;

    v_vehicle := null;
    v_driver  := null;
  end loop;

  raise notice 'Demo data complete.';
end;
$$;
