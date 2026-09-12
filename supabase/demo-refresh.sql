-- ===========================================================================
-- Busify — slide the demo data forward to today  (DEMO DATABASES ONLY)
--
--   npm run demo:refresh
--   (runs: npx supabase db query --linked -f supabase/demo-refresh.sql)
--
-- The console seed places everything relative to the moment it ran: a trip "in
-- two days", a quote "sent yesterday". A week later those have quietly become
-- the past — confirmed trips that departed days ago, a dispatch board with
-- nothing on it today. This moves the seeded records forward by the whole days
-- elapsed since the seed ran, so the demo reads the way it did on day one.
--
-- Unlike `supabase db reset` it touches nothing anyone added by hand, and it
-- keeps whatever was done to the seeded records since (assignments, payments,
-- status changes). Safe to run repeatedly: the anchors move with the data, so
-- a second run on the same day shifts by zero.
-- ===========================================================================

do $$
declare
  v_abc   uuid := 'aaaaaaaa-0000-4000-8000-000000000001';
  v_zone  text := 'America/Toronto';
  v_today date := (now() at time zone 'America/Toronto')::date;

  -- The reservations the console seed creates, by group name.
  v_trip_groups text[] := array[
    'Grade 12 Ottawa trip', 'Q3 offsite', 'Lefebvre wedding', 'Buffalo day trip',
    'Drama festival', 'Airport shuttle', 'Fall colours tour', 'Rehearsal shuttle'
  ];
  -- The quotes it creates, by title.
  v_quote_titles text[] := array[
    'Aurora holiday party shuttle', 'Grade 12 Québec City trip',
    'Lefebvre–Singh wedding shuttle', 'Aurora Q4 leadership retreat',
    'Buffalo Bills game day', 'Grade 9 Toronto Zoo field trip',
    'Pearson arrivals — sales kickoff'
  ];

  v_anchor date;
  v_zoo    date;
  v_days   int := 0;  -- reservations, requests, pay, tickets, maintenance
  v_qdays  int := 0;  -- quotes and the reservations converted from them
  v_shift  interval;
  v_qshift interval;
begin
  -- Reservations are seeded on local calendar days; the rehearsal shuttle is
  -- day -6, so its date plus six is the day the seed ran. Whole days only, so
  -- every trip keeps its time of day.
  select (departure_at at time zone v_zone)::date + 6
    into v_anchor
    from public.trips
   where organization_id = v_abc and group_name = 'Rehearsal shuttle' and quote_id is null
   limit 1;

  if v_anchor is not null then
    v_days := v_today - v_anchor;
  end if;

  -- Quotes were seeded against the calendar date; the zoo trip is day +12.
  select s.stop_date - 12
    into v_zoo
    from public.quote_trip_stops s
    join public.quote_trips t on t.id = s.quote_trip_id
    join public.quotes q on q.id = t.quote_id
   where q.organization_id = v_abc
     and q.title = 'Grade 9 Toronto Zoo field trip'
     and s.position = 0
   limit 1;

  if v_zoo is not null then
    v_qdays := v_today - v_zoo;
  end if;

  raise notice 'Shifting seeded reservations by % day(s), seeded quotes by % day(s).', v_days, v_qdays;

  v_shift  := make_interval(days => v_days);
  v_qshift := make_interval(days => v_qdays);

  -- -------------------------------------------------------------------------
  -- Reservations, and everything dated by them
  -- -------------------------------------------------------------------------
  if v_days <> 0 then
    update public.trips
       set departure_at      = departure_at + v_shift,
           return_at         = return_at + v_shift,
           garage_arrival_at = garage_arrival_at + v_shift,
           spot_at           = spot_at + v_shift,
           dropoff_at        = dropoff_at + v_shift,
           invoice_sent_at   = invoice_sent_at + v_shift
     where organization_id = v_abc
       and quote_id is null
       and group_name = any (v_trip_groups);

    update public.driver_pay_entries e
       set starts_at = e.starts_at + v_shift,
           ends_at   = e.ends_at + v_shift
      from public.trips t
     where e.trip_id = t.id
       and t.organization_id = v_abc
       and t.quote_id is null
       and t.group_name = any (v_trip_groups);

    update public.driver_pay_stubs
       set period_start = period_start + v_days,
           period_end   = period_end + v_days,
           created_at   = created_at + v_shift
     where organization_id = v_abc
       and id in (
         select e.pay_stub_id
           from public.driver_pay_entries e
           join public.trips t on t.id = e.trip_id
          where t.organization_id = v_abc
            and t.group_name = any (v_trip_groups)
       );

    update public.trip_requests
       set departure_at = departure_at + v_shift,
           return_at    = return_at + v_shift,
           created_at   = created_at + v_shift
     where organization_id = v_abc
       and contact_email in (
         'sarah@northfield.test', 'priya@auroratech.test',
         'chantal@lefebvre.test', 'tom@sunburstravel.test'
       )
       and destination in ('Ottawa', 'Blue Mountain', 'Niagara Falls', 'Buffalo');

    update public.tickets
       set created_at = created_at + v_shift
     where organization_id = v_abc
       and title in (
         'Coach arrived 20 minutes late to the venue',
         'Wi-Fi router on Coach 21 keeps dropping'
       );

    update public.vehicle_maintenance
       set scheduled_at = scheduled_at + v_shift
     where organization_id = v_abc
       and title = 'Annual MTO safety inspection';
  end if;

  -- -------------------------------------------------------------------------
  -- Quotes, their itineraries, and reservations converted from them
  -- -------------------------------------------------------------------------
  if v_qdays <> 0 then
    update public.quotes
       set created_at    = created_at + v_qshift,
           sent_at       = sent_at + v_qshift,
           first_sent_at = first_sent_at + v_qshift,
           responded_at  = responded_at + v_qshift,
           valid_until   = valid_until + v_qdays,
           expires_at    = expires_at + v_qshift,
           pickup_at     = pickup_at + v_qshift
     where organization_id = v_abc
       and title = any (v_quote_titles);

    update public.quote_trips t
       set departing_date   = t.departing_date + v_qdays,
           returning_date   = t.returning_date + v_qdays,
           balance_due_date = t.balance_due_date + v_qdays
      from public.quotes q
     where q.id = t.quote_id
       and q.organization_id = v_abc
       and q.title = any (v_quote_titles);

    update public.quote_trip_stops s
       set stop_date = s.stop_date + v_qdays
      from public.quote_trips t
      join public.quotes q on q.id = t.quote_id
     where s.quote_trip_id = t.id
       and q.organization_id = v_abc
       and q.title = any (v_quote_titles);

    update public.trips r
       set departure_at      = r.departure_at + v_qshift,
           return_at         = r.return_at + v_qshift,
           garage_arrival_at = r.garage_arrival_at + v_qshift,
           spot_at           = r.spot_at + v_qshift,
           dropoff_at        = r.dropoff_at + v_qshift,
           invoice_sent_at   = r.invoice_sent_at + v_qshift
      from public.quotes q
     where r.quote_id = q.id
       and q.organization_id = v_abc
       and q.title = any (v_quote_titles);
  end if;
end;
$$;
