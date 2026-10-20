-- ============================================================================
-- ParkGrid One - Admin Dashboard Real-Time Statistics
-- ============================================================================
-- PURPOSE:
--   Provides operational dashboard statistics, KPIs, 7-day revenue trend,
--   live operational alerts, and recent bookings directly from DB telemetry.
-- ============================================================================

create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id          uuid := auth.uid();
  v_now                timestamptz := pg_catalog.now();
  v_today_ist          date := (pg_catalog.timezone('Asia/Kolkata', v_now))::date;
  v_start_today_tz     timestamptz := (v_today_ist::text || ' 00:00:00 Asia/Kolkata')::timestamptz;
  v_end_today_tz       timestamptz := (v_today_ist::text || ' 23:59:59.999999 Asia/Kolkata')::timestamptz;
  
  v_bookings_today     int := 0;
  v_gross_today_paise  bigint := 0;
  v_refund_today_paise bigint := 0;
  v_revenue_today_paise bigint := 0;
  v_active_sessions    int := 0;
  v_total_active_slots int := 0;
  v_occupied_slots     int := 0;
  v_occupancy_percent  numeric := 0.0;
  
  v_recent_bookings    jsonb := '[]'::jsonb;
  v_revenue_7d         jsonb := '[]'::jsonb;
  v_alerts             jsonb := '[]'::jsonb;
  
  v_failed_payments_24h int := 0;
  v_overstay_sessions   int := 0;
  v_down_slots          int := 0;
begin
  -- 1. Security Check
  if v_caller_id is null or not public.is_admin() then
    raise exception 'Access denied: administrator privileges required' using errcode = '42501';
  end if;

  -- 2. Bookings created today (IST)
  select count(*)::int into v_bookings_today
  from public.bookings b
  where b.created_at between v_start_today_tz and v_end_today_tz;

  -- 3. Net Revenue today (IST): succeeded payments minus processed refunds
  select coalesce(sum(p.amount_paise), 0)::bigint into v_gross_today_paise
  from public.payments p
  where p.created_at between v_start_today_tz and v_end_today_tz
    and p.status in ('succeeded', 'refunded', 'partially_refunded');

  select coalesce(sum(pr.amount_paise), 0)::bigint into v_refund_today_paise
  from public.payment_refunds pr
  where pr.created_at between v_start_today_tz and v_end_today_tz
    and pr.status = 'processed';

  v_revenue_today_paise := v_gross_today_paise - v_refund_today_paise;

  -- 4. Active Sessions count
  select count(*)::int into v_active_sessions
  from public.parking_sessions ps
  where ps.status = 'active'
    and ps.ended_at is null;

  -- 5. Occupancy % (occupied or reserved right now / total active slots)
  select count(*)::int into v_total_active_slots
  from public.parking_slots sl
  where sl.admin_status = 'active';

  select count(distinct b.slot_id)::int into v_occupied_slots
  from public.bookings b
  where (
    (b.status in ('confirmed', 'active') and v_now between b.start_at and b.end_at)
    or exists (
      select 1 from public.parking_sessions ps
      where ps.booking_id = b.id
        and ps.status = 'active'
        and ps.ended_at is null
    )
  );

  if v_total_active_slots > 0 then
    v_occupancy_percent := round((v_occupied_slots::numeric / v_total_active_slots::numeric) * 100.0, 1);
  else
    v_occupancy_percent := 0.0;
  end if;

  -- 6. Recent 10 Bookings
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', rb.id,
        'reference', rb.reference,
        'slot_code', rb.slot_code,
        'plate_snapshot', rb.plate_snapshot,
        'start_at', rb.start_at,
        'end_at', rb.end_at,
        'status', rb.status,
        'total_paise', rb.total_paise,
        'created_at', rb.created_at
      ) order by rb.created_at desc
    ),
    '[]'::jsonb
  ) into v_recent_bookings
  from (
    select
      b.id,
      b.reference,
      sl.code as slot_code,
      b.plate_snapshot,
      b.start_at,
      b.end_at,
      b.status,
      b.total_paise,
      b.created_at
    from public.bookings b
    join public.parking_slots sl on sl.id = b.slot_id
    order by b.created_at desc
    limit 10
  ) rb;

  -- 7. Revenue last 7 days (including today)
  with days as (
    select (v_today_ist - i)::date as day_dt
    from pg_catalog.generate_series(6, 0, -1) as i
  ),
  day_bounds as (
    select
      d.day_dt,
      (d.day_dt::text || ' 00:00:00 Asia/Kolkata')::timestamptz as start_tz,
      (d.day_dt::text || ' 23:59:59.999999 Asia/Kolkata')::timestamptz as end_tz,
      pg_catalog.to_char(d.day_dt, 'YYYY-MM-DD') as date_str,
      pg_catalog.to_char(d.day_dt, 'Dy DD') as short_label
    from days d
  ),
  day_rev as (
    select
      db.date_str,
      db.short_label,
      coalesce(
        (
          select sum(p.amount_paise)
          from public.payments p
          where p.created_at between db.start_tz and db.end_tz
            and p.status in ('succeeded', 'refunded', 'partially_refunded')
        ),
        0
      ) - coalesce(
        (
          select sum(pr.amount_paise)
          from public.payment_refunds pr
          where pr.created_at between db.start_tz and db.end_tz
            and pr.status = 'processed'
        ),
        0
      ) as net_paise
    from day_bounds db
    order by db.day_dt asc
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'date', dr.date_str,
        'label', dr.short_label,
        'net_paise', dr.net_paise
      )
    ),
    '[]'::jsonb
  ) into v_revenue_7d
  from day_rev dr;

  -- 8. Active Operational Alerts
  -- (a) Failed payments in last 24h
  select count(*)::int into v_failed_payments_24h
  from public.payments p
  where p.status = 'failed'
    and p.created_at >= (v_now - '24 hours'::interval);

  -- (b) Overstaying active sessions
  select count(*)::int into v_overstay_sessions
  from public.parking_sessions ps
  where ps.status = 'active'
    and ps.ended_at is null
    and v_now > ps.booked_end_at;

  -- (c) Slots in maintenance or blocked
  select count(*)::int into v_down_slots
  from public.parking_slots sl
  where sl.admin_status in ('maintenance', 'blocked');

  -- Build alerts array
  select coalesce(
    jsonb_agg(alt),
    '[]'::jsonb
  ) into v_alerts
  from (
    select
      'failed_payments' as id,
      'warning' as severity,
      'Failed Payments Detected' as title,
      v_failed_payments_24h || ' payment attempts failed in the last 24 hours.' as description,
      'payments' as link_tab
    where v_failed_payments_24h > 0

    union all

    select
      'overstay_vehicles' as id,
      'error' as severity,
      'Active Overstay Vehicles' as title,
      v_overstay_sessions || ' parked vehicles have exceeded their booked end time.' as description,
      'sessions' as link_tab
    where v_overstay_sessions > 0

    union all

    select
      'slots_offline' as id,
      'info' as severity,
      'Slots Out of Service' as title,
      v_down_slots || ' slots are currently set to maintenance or blocked status.' as description,
      'slots' as link_tab
    where v_down_slots > 0
  ) alt;

  -- 9. Final Aggregate Payload
  return jsonb_build_object(
    'kpis', jsonb_build_object(
      'bookings_today', v_bookings_today,
      'revenue_today_paise', v_revenue_today_paise,
      'active_sessions_count', v_active_sessions,
      'occupancy_percent', v_occupancy_percent,
      'total_active_slots', v_total_active_slots,
      'occupied_slots', v_occupied_slots
    ),
    'revenue_last_7_days', v_revenue_7d,
    'recent_bookings', v_recent_bookings,
    'alerts', v_alerts,
    'generated_at', v_now
  );
end;
$$;

-- Privileges
revoke all on function public.admin_dashboard_stats() from public, anon;
grant execute on function public.admin_dashboard_stats() to authenticated;

comment on function public.admin_dashboard_stats() is
  'Aggregates live operational KPIs, 7-day revenue, recent bookings, and system alerts for admin dashboard.';
