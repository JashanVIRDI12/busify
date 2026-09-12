-- ===========================================================================
-- Busify — console demo data  (LOCAL DEVELOPMENT ONLY)
--
-- Appended to the core seed so the console has something to show: a pipeline
-- of quotes, companies, a fortnight of reservations with money and assignments
-- on them, a couple of tickets, and one payroll cycle.
--
-- Deliberately leaves gaps. Two reservations have no vehicle and one has no
-- driver, because an empty dispatch board proves nothing — the whole point of
-- those screens is showing what is *not* covered yet.
-- ===========================================================================

do $$
declare
  v_abc uuid := 'aaaaaaaa-0000-4000-8000-000000000001';
  v_owner uuid := '11111111-1111-4111-8111-111111111111';
  -- Local midnight today. Trips are laid out on the operator's clock, so a
  -- reset at 3 p.m. does not produce a school trip leaving at 10 p.m.
  v_day0 timestamp := date_trunc('day', now() at time zone 'America/Toronto');

  v_garage_main uuid;
  v_garage_lot  uuid;

  r record;
  v_trip uuid;
  v_vehicle uuid;
  v_driver uuid;
  v_stub uuid;
begin
  select id into v_garage_main from public.garages
   where organization_id = v_abc and name = 'Etobicoke Garage';
  select id into v_garage_lot from public.garages
   where organization_id = v_abc and name = 'Pearson Lot';

  -- -------------------------------------------------------------------------
  -- Companies, and the contacts that belong to them
  -- -------------------------------------------------------------------------
  -- Companies are deliberately *not* unique on name (two school boards really
  -- do run separate accounts under one), so re-running the seed is guarded by
  -- an explicit existence check rather than by `on conflict`.
  insert into public.companies (organization_id, name, email, phone, address_line1, city, province, postal_code, industry, groups)
  select v_abc, c.name, c.email, c.phone, c.address_line1, c.city, c.province, c.postal_code, c.industry, c.groups
  from (values
    ('Northfield Secondary School', 'office@northfield.test', '(416) 555-0301',
     '240 Bloor St W', 'Toronto', 'ON', 'M5S 1V6', 'School / School Board', array['School board']),
    ('Aurora Technologies', 'ap@auroratech.test', '(647) 555-0302',
     '2000 Argentia Rd', 'Mississauga', 'ON', 'L5N 1P7', 'Corporate', array['Net 30']),
    ('Lefebvre Wedding Co.', 'hello@lefebvre.test', '(905) 555-0303',
     '360 James St N', 'Hamilton', 'ON', 'L8L 1H5', 'Wedding', '{}'::text[]),
    ('Sunburst Travel', 'ops@sunburstravel.test', '(289) 555-0304',
     '1 St. Paul St', 'St. Catharines', 'ON', 'L2R 7L2', 'Tour Operator', array['Cross-border'])
  ) as c(name, email, phone, address_line1, city, province, postal_code, industry, groups)
  where not exists (
    select 1 from public.companies existing
    where existing.organization_id = v_abc and existing.name = c.name
  );

  update public.customers c
     set company_id = co.id,
         city       = co.city,
         province   = co.province,
         industry   = co.industry,
         address_line1 = co.address_line1
    from public.companies co
   where c.organization_id = v_abc
     and co.organization_id = v_abc
     and c.company = co.name
     and c.company_id is null;

  -- -------------------------------------------------------------------------
  -- Fleet and roster: home garages and amenities
  -- -------------------------------------------------------------------------
  update public.vehicles
     set garage_id = case when name like 'Van %' then v_garage_lot else v_garage_main end,
         amenities = case
           when capacity >= 50 then array['Bathroom', 'Luggage', 'Outlets', 'Wifi', 'TV Screens', 'Seat Belts']
           when capacity >= 25 then array['Luggage', 'Outlets', 'Seat Belts']
           else array['Outlets', 'Seat Belts']
         end
   where organization_id = v_abc and garage_id is null;

  update public.drivers
     set garage_id = v_garage_main
   where organization_id = v_abc and garage_id is null;

  -- -------------------------------------------------------------------------
  -- Reservations
  --
  -- Offsets are relative to today so the dispatch board, the calendar and the
  -- assignment timeline all have work on them whenever the seed is run. Every
  -- trip runs 07:00 to 19:00 local; `npm run demo:refresh` slides them forward
  -- again when a demo database has aged.
  -- -------------------------------------------------------------------------
  for r in
    select * from (values
      ('Northfield Secondary School', 'Sarah',   'Toronto',        'Ottawa',        'Grade 12 Ottawa trip',  1,  60, 'CONFIRMED',  8420.00, 8420.00, 'PAID'),
      ('Aurora Technologies',         'Priya',   'Mississauga',    'Blue Mountain', 'Q3 offsite',            2,  42, 'CONFIRMED',  6102.00, 3000.00, 'PARTIAL'),
      -- On the road today, so the dispatch board never opens on an empty day.
      ('Lefebvre Wedding Co.',        'Chantal', 'Hamilton',       'Niagara Falls', 'Lefebvre wedding',      0,  90, 'DISPATCHED', 4870.50,    0.00, 'UNPAID'),
      ('Sunburst Travel',             'Tom',     'St. Catharines', 'Buffalo',       'Buffalo day trip',      4,  24, 'SCHEDULED',  2260.00,    0.00, 'UNPAID'),
      ('Northfield Secondary School', 'Sarah',   'Toronto',        'Stratford',     'Drama festival',        6,  54, 'CONFIRMED',  3740.30,    0.00, 'UNPAID'),
      ('Aurora Technologies',         'Priya',   'Mississauga',    'Toronto',       'Airport shuttle',       9,  12, 'SCHEDULED',   960.50,  960.50, 'PAID'),
      ('Sunburst Travel',             'Tom',     'Toronto',        'Montréal',      'Fall colours tour',    14,  48, 'CONFIRMED', 10057.00, 2500.00, 'PARTIAL'),
      ('Lefebvre Wedding Co.',        'Chantal', 'Toronto',        'Collingwood',   'Rehearsal shuttle',    -6,  30, 'COMPLETED',  1695.00, 1695.00, 'PAID')
    ) as t(company, contact, pickup, destination, group_name, day_offset, passengers, status, total_due, paid, payment_status)
  loop
    -- Idempotent on the group name: re-running the seed must not double-book.
    if exists (
      select 1 from public.trips
       where organization_id = v_abc and group_name = r.group_name
    ) then
      continue;
    end if;

    insert into public.trips (
      organization_id, customer_id, company_id, garage_id,
      pickup_location, destination, group_name,
      departure_at, return_at, garage_arrival_at, spot_at, dropoff_at,
      passenger_count, status, total_due, amount_paid, payment_status,
      invoice_sent_at, created_by
    )
    select
      v_abc,
      c.id,
      co.id,
      v_garage_main,
      r.pickup,
      r.destination,
      r.group_name,
      (v_day0 + (r.day_offset || ' days')::interval + interval '7 hours') at time zone 'America/Toronto',
      (v_day0 + (r.day_offset || ' days')::interval + interval '19 hours') at time zone 'America/Toronto',
      (v_day0 + (r.day_offset || ' days')::interval + interval '6 hours') at time zone 'America/Toronto',
      (v_day0 + (r.day_offset || ' days')::interval + interval '6 hours 30 minutes') at time zone 'America/Toronto',
      (v_day0 + (r.day_offset || ' days')::interval + interval '17 hours') at time zone 'America/Toronto',
      r.passengers,
      r.status::public.trip_status,
      r.total_due,
      r.paid,
      r.payment_status::public.reservation_payment_status,
      case when r.paid > 0 then now() - interval '3 days' else null end,
      v_owner
    from public.companies co
    join public.customers c
      on c.organization_id = v_abc and c.first_name = r.contact
    where co.organization_id = v_abc and co.name = r.company
    limit 1;
  end loop;

  -- -------------------------------------------------------------------------
  -- Assignments
  --
  -- Every reservation except the last two gets a coach and a driver, matched on
  -- capacity. The gaps are the point: they are what the dispatch board is for.
  -- -------------------------------------------------------------------------
  for r in
    select t.id as trip_id, t.passenger_count, row_number() over (order by t.departure_at) as seq
      from public.trips t
     where t.organization_id = v_abc
       and not exists (
         select 1 from public.trip_assignments a where a.trip_id = t.id
       )
     order by t.departure_at
  loop
    exit when r.seq > 6;

    select v.id into v_vehicle
      from public.vehicles v
     where v.organization_id = v_abc
       and v.status <> 'INACTIVE'
       and v.capacity >= least(r.passenger_count, 56)
     order by v.capacity asc
     limit 1 offset (r.seq - 1) % 3;

    select d.id into v_driver
      from public.drivers d
     where d.organization_id = v_abc and d.status = 'ACTIVE'
     order by d.first_name
     limit 1 offset (r.seq - 1) % 3;

    if v_vehicle is null then
      continue;
    end if;

    insert into public.trip_assignments (organization_id, trip_id, vehicle_id, driver_id, role)
    values (
      v_abc,
      r.trip_id,
      v_vehicle,
      -- One reservation goes out with a coach and no driver, so "partially
      -- assigned" is a state the board actually renders.
      case when r.seq = 5 then null else v_driver end,
      'PRIMARY'
    );
  end loop;

  -- -------------------------------------------------------------------------
  -- Tickets
  -- -------------------------------------------------------------------------
  select id into v_trip from public.trips
   where organization_id = v_abc and group_name = 'Lefebvre wedding';

  if v_trip is not null and not exists (
    select 1 from public.tickets where organization_id = v_abc
  ) then
    insert into public.tickets (organization_id, trip_id, title, ticket_type, status, severity, created_by, assignee_id, body)
    values
      (v_abc, v_trip, 'Coach arrived 20 minutes late to the venue', 'Late Arrival',
       'OPEN', 'HIGH', v_owner, v_owner,
       'Traffic on the QEW. Customer has asked for a partial credit.'),
      (v_abc, null, 'Wi-Fi router on Coach 21 keeps dropping', 'Mechanical',
       'IN_PROGRESS', 'MEDIUM', v_owner, v_owner,
       'Third report this month. Booked in with the shop on Friday.');
  end if;

  -- -------------------------------------------------------------------------
  -- Driver pay: one settled cycle, one still in draft
  -- -------------------------------------------------------------------------
  insert into public.driver_pay_entries (
    organization_id, trip_id, driver_id, status, rate_basis, rate, quantity, total_pay, starts_at, ends_at
  )
  select
    v_abc, a.trip_id, a.driver_id,
    case when t.departure_at < now() then 'PENDING' else 'DRAFT' end::public.driver_pay_status,
    'HOURLY', 42.00, 12, 504.00,
    t.departure_at, coalesce(t.return_at, t.dropoff_at)
  from public.trip_assignments a
  join public.trips t on t.id = a.trip_id
  where a.organization_id = v_abc and a.driver_id is not null
  on conflict (organization_id, trip_id, driver_id) do nothing;

  -- Roll the past cycle into a stub so the Pay Stubs tab is not empty.
  for r in
    select e.driver_id, d.first_name, sum(e.total_pay) as total,
           min(e.starts_at)::date as period_start, max(e.ends_at)::date as period_end
      from public.driver_pay_entries e
      join public.drivers d on d.id = e.driver_id
     where e.organization_id = v_abc
       and e.pay_stub_id is null
       and e.starts_at < now()
     group by e.driver_id, d.first_name
  loop
    insert into public.driver_pay_stubs (
      organization_id, reference, driver_id, status, total_pay, period_start, period_end
    )
    values (
      v_abc,
      upper(substr(md5(random()::text), 1, 5)) || '_' || r.first_name,
      r.driver_id,
      'PENDING',
      r.total,
      r.period_start,
      r.period_end
    )
    returning id into v_stub;

    update public.driver_pay_entries
       set pay_stub_id = v_stub, status = 'PENDING'
     where organization_id = v_abc
       and driver_id = r.driver_id
       and pay_stub_id is null
       and starts_at < now();
  end loop;
end;
$$;

-- ===========================================================================
-- Settings demo data
--
-- The rate card, the reusable charges and the addresses an operator would have
-- set up in their first week. Without these the quote builder opens on zeroes
-- and the settings screens read as empty rather than as configurable.
-- ===========================================================================

do $$
declare
  v_abc uuid := 'aaaaaaaa-0000-4000-8000-000000000001';
begin
  -- Rates per vehicle type. The migration seeds these from the legacy columns
  -- on vehicle_types; this sets the numbers an operator would actually quote.
  update public.vehicle_rates r
     set live_mile_rate = c.live,
         dead_mile_rate = c.dead,
         hourly_rate    = c.hourly,
         minimum_hours  = 6,
         daily_rate     = c.daily
    from (values
      ('Highway Coach', 5.00, 4.50, 200.00, 1800.00),
      ('Mini Coach',    3.50, 3.00, 140.00, 1100.00),
      ('Executive Van', 3.00, 2.50, 100.00,  600.00)
    ) as c(type_name, live, dead, hourly, daily)
    join public.vehicle_types vt
      on vt.organization_id = v_abc and vt.name = c.type_name
   where r.organization_id = v_abc
     and r.vehicle_type_id = vt.id
     and r.vehicle_id is null;

  -- Charges, markups and taxes an operator maintains once and reuses.
  insert into public.custom_charges
    (organization_id, category, name, rate_type, rate, placement, tax_exempt, default_on_quote, position)
  select v_abc, c.category::public.charge_category, c.name,
         c.rate_type::public.charge_rate_type, c.rate,
         'ITEMIZED'::public.charge_placement, c.tax_exempt, c.is_default, c.position
  from (values
    ('CHARGE', 'Extra Hours',           'PER_QUANTITY', 150.00, false, false, 0),
    ('CHARGE', 'Highway 407 Toll',      'FLAT',         170.00, true,  false, 1),
    ('CHARGE', 'Second Driver',         'FLAT',         700.00, false, false, 2),
    ('CHARGE', 'Niagara Parking Permit','FLAT',         110.00, false, false, 3),
    ('CHARGE', 'Airport Pickup Fee',    'FLAT',         106.95, false, false, 4),
    ('CHARGE', 'Driver Accommodation',  'FLAT',         300.00, false, false, 5),
    ('CHARGE', 'Fuel Surcharge',        'FLAT',        1200.00, false, false, 6),
    ('CHARGE', 'Driver Gratuity',       'PERCENTAGE',    10.00, false, true,  7),
    ('CHARGE', 'Tolls',                 'FLAT',         200.00, false, false, 8),
    ('MARKUP', 'Peak Season',           'PERCENTAGE',    12.00, false, false, 0),
    ('MARKUP', 'Cross-border',          'FLAT',         250.00, false, false, 1),
    ('TAX',    'Ontario HST',           'PERCENTAGE',    13.00, false, true,  0)
  ) as c(category, name, rate_type, rate, tax_exempt, is_default, position)
  where not exists (
    select 1 from public.custom_charges existing
    where existing.organization_id = v_abc
      and existing.category = c.category::public.charge_category
      and existing.name = c.name
  );

  insert into public.saved_stops (organization_id, name, address, notes)
  select v_abc, s.name, s.address, s.notes
  from (values
    ('Pearson Terminal 1', '6301 Silver Dart Dr, Mississauga, ON L5P 1B2',
     'Coach pickup is on the arrivals level, column D.'),
    ('Northfield Secondary School', '240 Bloor St W, Toronto, ON M5S 1V6',
     'Enter from the staff lot. Do not block the bus loop before 15:30.'),
    ('Blue Mountain Resort', '190 Gord Canning Dr, The Blue Mountains, ON',
     'Drop at the Village gate; park in lot 4.')
  ) as s(name, address, notes)
  where not exists (
    select 1 from public.saved_stops existing
    where existing.organization_id = v_abc and existing.name = s.name
  );

  -- Quote-page terms, alongside the contract terms the core seed creates.
  insert into public.contract_terms (organization_id, kind, name, body, is_default)
  values (
    v_abc, 'QUOTE', 'Quote Terms',
    E'This quote is valid for 14 days from the date sent.\n'
    'Prices are estimates based on the itinerary supplied and may change if it does.\n'
    'A deposit is required to confirm the booking.',
    true
  )
  on conflict (organization_id, kind, name) do nothing;
end;
$$;

-- ===========================================================================
-- Quotes demo data
--
-- The Quotes list is the console's home page, so it must not open empty. These
-- cover the pipeline an operator actually works: fresh leads, quotes out with
-- the customer, one being chased, one gone stale past its expiry, and one lost.
--
-- Totals follow the same rules as lib/pricing/quote.ts — the highest base-fare
-- candidate, itemized charges on top, HST on the taxable subtotal — so opening
-- one in the builder shows the numbers the builder would have produced itself.
-- ===========================================================================

do $$
declare
  v_abc   uuid := 'aaaaaaaa-0000-4000-8000-000000000001';
  v_owner uuid := '11111111-1111-4111-8111-111111111111';
  v_disp  uuid := '22222222-2222-4222-8222-222222222222';
  v_zone  text := 'America/Toronto';
  v_today date := (now() at time zone 'America/Toronto')::date;

  v_garage    uuid;
  v_terms     uuid;
  v_tax_label text;

  q record;
  s record;
  c record;

  v_contact_id uuid;
  v_company_id uuid;
  v_quote      uuid;
  v_trip       uuid;

  v_first_date date;
  v_first_time time;
  v_last_date  date;
  v_last_time  time;

  v_base       numeric;
  v_amount     numeric;
  v_subtotal   numeric;
  v_nontaxable numeric;
  v_tax        numeric;
  v_total      numeric;
  v_sent       timestamptz;
  v_valid      date;
begin
  select id into v_garage from public.garages
   where organization_id = v_abc and name = 'Etobicoke Garage';

  select id into v_terms from public.contract_terms
   where organization_id = v_abc and kind = 'CONTRACT' and is_default
   limit 1;

  -- The label the builder gives its seeded tax row: "HST# 123456789 RT 0001".
  select case when gst_hst_number is null then 'HST' else 'HST# ' || gst_hst_number end
    into v_tax_label
    from public.organizations where id = v_abc;

  -- New quotes start from the main garage instead of an empty dropdown.
  update public.organization_settings
     set default_garage_id = v_garage
   where organization_id = v_abc and default_garage_id is null;

  for q in
    select * from (values
      ('Aurora holiday party shuttle', 'Priya', 'Corporate', 'FOLLOW_UP', 'NORMAL', 'owner', 'owner',
       21, 20, 14, 'ROUND_TRIP', 24, 'Mini Coach', 1,
       1100.00, 140.00, 3.50, 450.00, 0, 6, 40, 70, 25,
       '[{"d":95,"t":"18:00","k":"PICKUP","l":"Aurora Technologies","a":"2000 Argentia Rd, Mississauga, ON L5N 1P7"},
         {"d":95,"t":"18:45","k":"STOP","l":"Liberty Grand","a":"25 British Columbia Rd, Toronto, ON M6K 3C3"},
         {"d":95,"t":"23:15","k":"DROPOFF","l":"Aurora Technologies","a":"2000 Argentia Rd, Mississauga, ON L5N 1P7"}]'::jsonb,
       '[{"l":"Driver Gratuity","k":"PERCENT","r":10}]'::jsonb,
       'Staff holiday party. A second run is needed if the headcount passes 25.'),

      ('Grade 12 Québec City trip', 'Sarah', 'K-12', 'LOST', 'NORMAL', 'owner', 'owner',
       12, 10, 14, 'ROUND_TRIP', 54, 'Highway Coach', 1,
       1800.00, 200.00, 5.00, 850.00, 3, 30, 1600, 1080, 25,
       '[{"d":45,"t":"06:30","k":"PICKUP","l":"Northfield Secondary School","a":"240 Bloor St W, Toronto, ON M5S 1V6"},
         {"d":45,"t":"16:00","k":"STOP","l":"Château Frontenac","a":"1 Rue des Carrières, Québec, QC G1R 4P5"},
         {"d":47,"t":"09:00","k":"STOP","l":"Château Frontenac","a":"1 Rue des Carrières, Québec, QC G1R 4P5"},
         {"d":47,"t":"18:30","k":"DROPOFF","l":"Northfield Secondary School","a":"240 Bloor St W, Toronto, ON M5S 1V6"}]'::jsonb,
       '[{"l":"Driver Accommodation","k":"FLAT","r":300,"q":2},
         {"l":"Driver Gratuity","k":"PERCENT","r":10}]'::jsonb,
       'The school went with a rail package this year. Re-quote in January for 2027.'),

      ('Lefebvre–Singh wedding shuttle', 'Chantal', 'Wedding', 'FOLLOW_UP', 'URGENT', 'disp', 'owner',
       7, 6, 14, 'SHUTTLE', 48, 'Mini Coach', 2,
       2200.00, 280.00, 7.00, 900.00, 1, 9, 60, 150, 50,
       '[{"d":8,"t":"15:00","k":"PICKUP","l":"Sheraton Hamilton Hotel","a":"116 King St W, Hamilton, ON L8P 4V3"},
         {"d":8,"t":"15:30","k":"STOP","l":"Cathedral Basilica of Christ the King","a":"714 King St W, Hamilton, ON L8P 1C7"},
         {"d":8,"t":"22:30","k":"DROPOFF","l":"Liuna Station","a":"360 James St N, Hamilton, ON L8L 1H5"}]'::jsonb,
       '[{"l":"Driver Gratuity","k":"PERCENT","r":10}]'::jsonb,
       'Two coaches loop hotel, church and hall. The bride has asked for white ribbon on both.'),

      ('Aurora Q4 leadership retreat', 'Priya', 'Corporate', 'QUOTED', 'NORMAL', 'owner', 'owner',
       3, 2, 14, 'ROUND_TRIP', 44, 'Highway Coach', 1,
       1800.00, 200.00, 5.00, 850.00, 2, 18, 290, 240, 25,
       '[{"d":21,"t":"07:30","k":"PICKUP","l":"Aurora Technologies","a":"2000 Argentia Rd, Mississauga, ON L5N 1P7"},
         {"d":21,"t":"09:15","k":"STOP","l":"Queen''s Landing Hotel","a":"155 Byron St, Niagara-on-the-Lake, ON L0S 1J0"},
         {"d":22,"t":"15:00","k":"STOP","l":"Queen''s Landing Hotel","a":"155 Byron St, Niagara-on-the-Lake, ON L0S 1J0"},
         {"d":22,"t":"16:45","k":"DROPOFF","l":"Aurora Technologies","a":"2000 Argentia Rd, Mississauga, ON L5N 1P7"}]'::jsonb,
       '[{"l":"Driver Accommodation","k":"FLAT","r":300},
         {"l":"Driver Gratuity","k":"PERCENT","r":10}]'::jsonb,
       'The coach stays with the group overnight. The driver''s room is booked at the hotel.'),

      ('Buffalo Bills game day', 'Tom', 'Athletics', 'QUOTED', 'HIGH', 'owner', 'disp',
       2, 1, 14, 'ROUND_TRIP', 52, 'Highway Coach', 1,
       1800.00, 200.00, 5.00, 850.00, 1, 12, 190, 210, 25,
       '[{"d":30,"t":"09:00","k":"PICKUP","l":"Sunburst Travel","a":"1 St. Paul St, St. Catharines, ON L2R 7L2"},
         {"d":30,"t":"10:45","k":"STOP","l":"Highmark Stadium","a":"1 Bills Dr, Orchard Park, NY 14127"},
         {"d":30,"t":"19:30","k":"DROPOFF","l":"Sunburst Travel","a":"1 St. Paul St, St. Catharines, ON L2R 7L2"}]'::jsonb,
       '[{"l":"Cross-border","k":"FLAT","r":250},
         {"l":"Tolls","k":"FLAT","r":200,"x":false},
         {"l":"Driver Gratuity","k":"PERCENT","r":10}]'::jsonb,
       'Passports checked at pickup. Peace Bridge crossing both ways.'),

      ('Grade 9 Toronto Zoo field trip', 'Sarah', 'K-12', 'LEAD', 'HIGH', 'owner', 'owner',
       1, null, 14, 'ROUND_TRIP', 52, 'Highway Coach', 1,
       1800.00, 200.00, 5.00, 850.00, 0, 7, 42, 80, 25,
       '[{"d":12,"t":"08:30","k":"PICKUP","l":"Northfield Secondary School","a":"240 Bloor St W, Toronto, ON M5S 1V6"},
         {"d":12,"t":"09:15","k":"STOP","l":"Toronto Zoo","a":"2000 Meadowvale Rd, Toronto, ON M1B 5K7"},
         {"d":12,"t":"15:15","k":"DROPOFF","l":"Northfield Secondary School","a":"240 Bloor St W, Toronto, ON M5S 1V6"}]'::jsonb,
       '[{"l":"Driver Gratuity","k":"PERCENT","r":10}]'::jsonb,
       'Two wheelchair users. A lift-equipped coach is required.'),

      ('Pearson arrivals — sales kickoff', 'Priya', 'Airport Transfer', 'LEAD', 'LOW', null, 'disp',
       0, null, 14, 'ONE_WAY', 11, 'Executive Van', 1,
       600.00, 100.00, 3.00, 275.00, 0, 3, 25, 40, 0,
       '[{"d":5,"t":"13:00","k":"PICKUP","l":"Pearson Terminal 1","a":"6301 Silver Dart Dr, Mississauga, ON L5P 1B2"},
         {"d":5,"t":"13:40","k":"DROPOFF","l":"Delta Hotels Toronto Airport","a":"655 Dixon Rd, Toronto, ON M9W 1J3"}]'::jsonb,
       '[{"l":"Airport Pickup Fee","k":"FLAT","r":106.95},
         {"l":"Driver Gratuity","k":"PERCENT","r":10}]'::jsonb,
       null)
    ) as t(title, contact, event, pipeline, priority, rep, creator,
           created_ago, sent_ago, expiry_days, trip_type, pax, vtype, vqty,
           r_daily, r_hourly, r_km, r_base, days, hours, km, minutes, due_pct,
           stops, charges, notes)
    -- Oldest first, so the record numbers rise with the creation dates.
    order by created_ago desc
  loop
    -- Idempotent on the title: re-running the seed must not duplicate quotes.
    if exists (
      select 1 from public.quotes
       where organization_id = v_abc and title = q.title
    ) then
      continue;
    end if;

    select id, company_id into v_contact_id, v_company_id
      from public.customers
     where organization_id = v_abc and first_name = q.contact
     limit 1;

    v_sent := case when q.sent_ago is null then null
                   else now() - make_interval(days => q.sent_ago) end;
    v_valid := case when v_sent is null then null
                    else (v_sent at time zone v_zone)::date + q.expiry_days end;

    insert into public.quotes (
      organization_id, customer_id, company_id, title, event_name,
      status, pipeline_status, priority, sales_rep_id, created_by,
      currency, tax_province, tax_rate_percent, contract_terms_id,
      customer_visibility, expiry_days,
      sent_at, first_sent_at, valid_until, expires_at, responded_at,
      notes, created_at
    )
    values (
      v_abc, v_contact_id, v_company_id, q.title, q.event,
      (case q.pipeline when 'LEAD' then 'DRAFT' when 'LOST' then 'DECLINED' else 'SENT' end)::public.quote_status,
      q.pipeline::public.quote_pipeline_status,
      q.priority::public.quote_priority,
      case q.rep when 'owner' then v_owner when 'disp' then v_disp end,
      case q.creator when 'owner' then v_owner else v_disp end,
      'CAD', 'ON', 13, v_terms,
      'LINE_ITEM_CALCS', q.expiry_days,
      v_sent, v_sent, v_valid,
      -- The same end-of-day stamp the send action writes.
      case when v_valid is null then null else (v_valid::text || 'T23:59:59Z')::timestamptz end,
      case when q.pipeline = 'LOST' then now() - interval '4 days' end,
      q.notes,
      now() - make_interval(days => q.created_ago)
    )
    returning id into v_quote;

    insert into public.quote_payment_methods (organization_id, quote_id, method, position, enabled, online_processing)
    values
      (v_abc, v_quote, 'CARD',  0, true,  true),
      (v_abc, v_quote, 'BANK',  1, true,  true),
      (v_abc, v_quote, 'CHECK', 2, true,  false),
      (v_abc, v_quote, 'WIRE',  3, false, false),
      (v_abc, v_quote, 'OTHER', 4, false, false);

    v_first_date := v_today + (q.stops -> 0 ->> 'd')::int;
    v_first_time := (q.stops -> 0 ->> 't')::time;
    v_last_date  := v_today + (q.stops -> -1 ->> 'd')::int;
    v_last_time  := (q.stops -> -1 ->> 't')::time;

    insert into public.quote_trips (
      organization_id, quote_id, position, name, trip_type, passenger_count, driver_count,
      departing_garage_id, departing_date, departing_time, departing_arrival_time,
      returning_garage_id, returning_date, returning_time,
      return_leg_miles, return_leg_minutes,
      base_fare_mode, rate_daily, rate_hourly, rate_per_mile, rate_flat_base,
      days, hours, total_miles, dead_miles, live_miles, estimated_minutes,
      due_now_percent, notes
    )
    values (
      v_abc, v_quote, 0, 'Trip 1', q.trip_type::public.quote_trip_type, q.pax, q.vqty,
      v_garage, v_first_date, v_first_time - interval '45 minutes', v_first_time - interval '15 minutes',
      v_garage, v_last_date, v_last_time + interval '40 minutes',
      round(q.km * 0.1), 30,
      'HIGHEST', q.r_daily, q.r_hourly, q.r_km, q.r_base,
      q.days, q.hours, q.km, round(q.km * 0.2), q.km - round(q.km * 0.2), q.minutes,
      q.due_pct, null
    )
    returning id into v_trip;

    for s in
      select e.value as j, e.ordinality - 1 as pos
        from jsonb_array_elements(q.stops) with ordinality as e(value, ordinality)
    loop
      insert into public.quote_trip_stops (
        organization_id, quote_trip_id, position, kind, label, address,
        stop_date, stop_time, spot_time
      )
      values (
        v_abc, v_trip, s.pos, (s.j ->> 'k')::public.quote_stop_kind, s.j ->> 'l', s.j ->> 'a',
        v_today + (s.j ->> 'd')::int, (s.j ->> 't')::time,
        case when s.j ->> 'k' = 'PICKUP' then (s.j ->> 't')::time - interval '15 minutes' end
      );
    end loop;

    insert into public.quote_trip_vehicles (organization_id, quote_trip_id, position, vehicle_type_id, quantity)
    select v_abc, v_trip, 0, vt.id, q.vqty
      from public.vehicle_types vt
     where vt.organization_id = v_abc and vt.name = q.vtype;

    -- Base fare: the highest of the four candidates (base_fare_mode HIGHEST).
    v_base := greatest(
      round(q.r_daily * q.days, 2),
      round(q.r_hourly * q.hours, 2),
      round(q.r_km * q.km, 2),
      q.r_base
    );
    v_subtotal := v_base;
    v_nontaxable := 0;

    insert into public.quote_items (organization_id, quote_id, kind, description, quantity, unit_price, amount, position)
    values (v_abc, v_quote, 'VEHICLE', 'Base fare', 1, v_base, v_base, 0);

    -- Itemized charges. A percentage is of the total base fare.
    for c in
      select e.value as j, e.ordinality - 1 as pos
        from jsonb_array_elements(q.charges) with ordinality as e(value, ordinality)
    loop
      v_amount := case c.j ->> 'k'
        when 'PERCENT' then round(round(v_base * (c.j ->> 'r')::numeric / 100, 2)
                                  * coalesce((c.j ->> 'q')::numeric, 1), 2)
        else round((c.j ->> 'r')::numeric * coalesce((c.j ->> 'q')::numeric, 1), 2)
      end;

      insert into public.quote_trip_charges (
        organization_id, quote_trip_id, position, section, label, kind, rate, quantity, amount, taxable
      )
      values (
        v_abc, v_trip, c.pos, 'ITEMIZED', c.j ->> 'l', (c.j ->> 'k')::public.quote_charge_kind,
        (c.j ->> 'r')::numeric, coalesce((c.j ->> 'q')::numeric, 1), v_amount,
        coalesce((c.j ->> 'x')::boolean, true)
      );

      insert into public.quote_items (organization_id, quote_id, kind, description, quantity, unit_price, amount, position)
      values (v_abc, v_quote, 'ADDITIONAL_SERVICE', c.j ->> 'l', 1, v_amount, v_amount, c.pos + 1);

      v_subtotal := v_subtotal + v_amount;
      if not coalesce((c.j ->> 'x')::boolean, true) then
        v_nontaxable := v_nontaxable + v_amount;
      end if;
    end loop;

    -- HST on the taxable subtotal.
    v_tax := round((v_subtotal - v_nontaxable) * 13 / 100, 2);
    v_total := v_subtotal + v_tax;

    insert into public.quote_trip_charges (
      organization_id, quote_trip_id, position, section, label, kind, rate, quantity, amount, taxable
    )
    values (v_abc, v_trip, 0, 'TAX', v_tax_label, 'PERCENT', 13, 1, v_tax, false);

    update public.quote_trips
       set base_fare_total = v_base,
           subtotal        = v_subtotal,
           tax_total       = v_tax,
           total           = v_total
     where id = v_trip;

    update public.quotes
       set subtotal       = v_subtotal,
           tax            = v_tax,
           total          = v_total,
           deposit_amount = round(v_total * q.due_pct / 100, 2),
           pickup_at      = (v_first_date + v_first_time) at time zone v_zone,
           pickup_address = q.stops -> 0 ->> 'a'
     where id = v_quote;
  end loop;
end;
$$;
