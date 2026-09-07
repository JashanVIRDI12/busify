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
  insert into public.companies (organization_id, name, email, phone, address_line1, city, province, postal_code, industry, groups)
  values
    (v_abc, 'Northfield Secondary School', 'office@northfield.test', '(416) 555-0301',
     '240 Bloor St W', 'Toronto', 'ON', 'M5S 1V6', 'School / School Board', array['School board']),
    (v_abc, 'Aurora Technologies', 'ap@auroratech.test', '(647) 555-0302',
     '2000 Argentia Rd', 'Mississauga', 'ON', 'L5N 1P7', 'Corporate', array['Net 30']),
    (v_abc, 'Lefebvre Wedding Co.', 'hello@lefebvre.test', '(905) 555-0303',
     '360 James St N', 'Hamilton', 'ON', 'L8L 1H5', 'Wedding', array['{}']::text[]),
    (v_abc, 'Sunburst Travel', 'ops@sunburstravel.test', '(289) 555-0304',
     '1 St. Paul St', 'St. Catharines', 'ON', 'L2R 7L2', 'Tour Operator', array['Cross-border'])
  on conflict do nothing;

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
