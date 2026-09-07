-- ===========================================================================
-- Busify — console demo data  (LOCAL DEVELOPMENT ONLY)
--
-- Appended to the core seed so the operations screens have something to show:
-- companies, a fortnight of reservations with money and assignments on them,
-- a couple of tickets, and one payroll cycle.
--
-- Deliberately leaves gaps. Two reservations have no vehicle and one has no
-- driver, because an empty dispatch board proves nothing — the whole point of
-- those screens is showing what is *not* covered yet.
-- ===========================================================================

do $$
declare
  v_abc uuid := 'aaaaaaaa-0000-4000-8000-000000000001';
  v_owner uuid := '11111111-1111-4111-8111-111111111111';

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
  -- Offsets are relative to `now()` so the dispatch board, the calendar and the
  -- assignment timeline all have work on them whenever the seed is run.
  -- -------------------------------------------------------------------------
  for r in
    select * from (values
      ('Northfield Secondary School', 'Sarah',   'Toronto',        'Ottawa',        'Grade 12 Ottawa trip',  1,  60, 'CONFIRMED',  8420.00, 8420.00, 'PAID'),
      ('Aurora Technologies',         'Priya',   'Mississauga',    'Blue Mountain', 'Q3 offsite',            2,  42, 'CONFIRMED',  6102.00, 3000.00, 'PARTIAL'),
      ('Lefebvre Wedding Co.',        'Chantal', 'Hamilton',       'Niagara Falls', 'Lefebvre wedding',      3,  90, 'DISPATCHED', 4870.50,    0.00, 'UNPAID'),
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
      date_trunc('hour', now()) + (r.day_offset || ' days')::interval + interval '7 hours',
      date_trunc('hour', now()) + (r.day_offset || ' days')::interval + interval '19 hours',
      date_trunc('hour', now()) + (r.day_offset || ' days')::interval + interval '6 hours',
      date_trunc('hour', now()) + (r.day_offset || ' days')::interval + interval '6 hours 30 minutes',
      date_trunc('hour', now()) + (r.day_offset || ' days')::interval + interval '17 hours',
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
