-- ============================================================================
-- Migration: 20261020200000_fix_admin_dashboard_and_revenue.sql
-- Description:
--   1. Fix admin_dashboard_stats() to remove references to non-existent
--      column `status` on `public.payment_refunds`.
--   2. Fix admin_revenue_report() to remove references to non-existent
--      column `status` on `public.payment_refunds`.
--   3. Ensure defensive left join on parking_slots and safe timestamp calculations.
-- ============================================================================

-- ── 1. ADMIN DASHBOARD STATS ────────────────────────────────────────────────
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

  -- 3. Net Revenue today (IST): succeeded payments minus refunds recorded in the window
  select coalesce(sum(p.amount_paise), 0)::bigint into v_gross_today_paise
  from public.payments p
  where p.created_at between v_start_today_tz and v_end_today_tz
    and p.status in ('succeeded', 'refunded', 'partially_refunded');

  select coalesce(sum(pr.amount_paise), 0)::bigint into v_refund_today_paise
  from public.payment_refunds pr
  where pr.created_at between v_start_today_tz and v_end_today_tz;

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
      coalesce(sl.code, 'N/A') as slot_code,
      b.plate_snapshot,
      b.start_at,
      b.end_at,
      b.status,
      b.total_paise,
      b.created_at
    from public.bookings b
    left join public.parking_slots sl on sl.id = b.slot_id
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
    and (ps.booked_end_at is not null and v_now > ps.booked_end_at);

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

revoke all on function public.admin_dashboard_stats() from public, anon;
grant execute on function public.admin_dashboard_stats() to authenticated;

comment on function public.admin_dashboard_stats() is
  'Returns operational metrics, 7-day revenue trend, alerts, and recent bookings for Admin Dashboard.';


-- ── 2. ADMIN REVENUE REPORT ──────────────────────────────────────────────────
create or replace function public.admin_revenue_report(
  p_from  date default null,
  p_to    date default null,
  p_group text default 'day'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id uuid := auth.uid();
  v_diff_days int;
  v_from_tz   timestamptz;
  v_to_tz     timestamptz;
  v_result    jsonb;
  v_today_ist date := (pg_catalog.timezone('Asia/Kolkata', pg_catalog.now()))::date;
  v_from_date date;
  v_to_date   date;

  v_total_gross   bigint := 0;
  v_total_refunds bigint := 0;
  v_total_net     bigint := 0;
  v_total_gst     bigint := 0;
  v_total_bookings bigint := 0;
  v_total_cancelled bigint := 0;
  v_total_overstay bigint := 0;
begin
  -- 1. Security Check
  if v_caller_id is null or not public.is_admin() then
    raise exception 'Access denied: administrator privileges required' using errcode = '42501';
  end if;

  -- 2. Input Defaults and Validation
  v_from_date := coalesce(p_from, v_today_ist);
  v_to_date   := coalesce(p_to, v_today_ist);

  if v_from_date > v_to_date then
    raise exception 'Invalid date range: start date must be before or equal to end date' using errcode = 'P0001';
  end if;

  v_diff_days := (v_to_date - v_from_date);
  if v_diff_days > 366 then
    raise exception 'Date range exceeds maximum limit of 366 days' using errcode = 'P0001';
  end if;

  if p_group not in ('day', 'week', 'month') then
    raise exception 'Invalid grouping: must be day, week, or month' using errcode = 'P0001';
  end if;

  -- Interpret inputs in Asia/Kolkata timezone
  v_from_tz := (v_from_date::text || ' 00:00:00 Asia/Kolkata')::timestamptz;
  v_to_tz   := (v_to_date::text   || ' 23:59:59.999999 Asia/Kolkata')::timestamptz;

  with period_series as (
    select
      case p_group
        when 'day'   then pg_catalog.to_char(pg_catalog.timezone('Asia/Kolkata', d), 'YYYY-MM-DD')
        when 'week'  then pg_catalog.to_char(pg_catalog.timezone('Asia/Kolkata', pg_catalog.date_trunc('week', d)), 'YYYY-"W"IW')
        when 'month' then pg_catalog.to_char(pg_catalog.timezone('Asia/Kolkata', pg_catalog.date_trunc('month', d)), 'YYYY-MM')
      end as period_label,
      min(d) as p_start,
      max(d) as p_end
    from pg_catalog.generate_series(v_from_tz, v_to_tz, '1 day'::interval) as d
    group by 1
  ),
  period_payments as (
    select
      case p_group
        when 'day'   then pg_catalog.to_char(pg_catalog.timezone('Asia/Kolkata', p.created_at), 'YYYY-MM-DD')
        when 'week'  then pg_catalog.to_char(pg_catalog.timezone('Asia/Kolkata', pg_catalog.date_trunc('week', p.created_at)), 'YYYY-"W"IW')
        when 'month' then pg_catalog.to_char(pg_catalog.timezone('Asia/Kolkata', pg_catalog.date_trunc('month', p.created_at)), 'YYYY-MM')
      end as period_label,
      coalesce(sum(case when p.status in ('succeeded', 'refunded', 'partially_refunded') then p.amount_paise else 0 end), 0)::bigint as gross_paise,
      coalesce(sum(case when p.status in ('succeeded', 'refunded', 'partially_refunded') then p.gst_paise else 0 end), 0)::bigint as gst_paise
    from public.payments p
    where p.created_at between v_from_tz and v_to_tz
    group by 1
  ),
  period_refunds as (
    select
      case p_group
        when 'day'   then pg_catalog.to_char(pg_catalog.timezone('Asia/Kolkata', pr.created_at), 'YYYY-MM-DD')
        when 'week'  then pg_catalog.to_char(pg_catalog.timezone('Asia/Kolkata', pg_catalog.date_trunc('week', pr.created_at)), 'YYYY-"W"IW')
        when 'month' then pg_catalog.to_char(pg_catalog.timezone('Asia/Kolkata', pg_catalog.date_trunc('month', pr.created_at)), 'YYYY-MM')
      end as period_label,
      coalesce(sum(pr.amount_paise), 0)::bigint as refund_paise
    from public.payment_refunds pr
    where pr.created_at between v_from_tz and v_to_tz
    group by 1
  ),
  period_bookings as (
    select
      case p_group
        when 'day'   then pg_catalog.to_char(pg_catalog.timezone('Asia/Kolkata', b.created_at), 'YYYY-MM-DD')
        when 'week'  then pg_catalog.to_char(pg_catalog.timezone('Asia/Kolkata', pg_catalog.date_trunc('week', b.created_at)), 'YYYY-"W"IW')
        when 'month' then pg_catalog.to_char(pg_catalog.timezone('Asia/Kolkata', pg_catalog.date_trunc('month', b.created_at)), 'YYYY-MM')
      end as period_label,
      count(*)::bigint as bookings_count,
      count(*) filter (where b.status = 'cancelled')::bigint as cancelled_count
    from public.bookings b
    where b.created_at between v_from_tz and v_to_tz
    group by 1
  ),
  period_overstay as (
    select
      case p_group
        when 'day'   then pg_catalog.to_char(pg_catalog.timezone('Asia/Kolkata', oc.created_at), 'YYYY-MM-DD')
        when 'week'  then pg_catalog.to_char(pg_catalog.timezone('Asia/Kolkata', pg_catalog.date_trunc('week', oc.created_at)), 'YYYY-"W"IW')
        when 'month' then pg_catalog.to_char(pg_catalog.timezone('Asia/Kolkata', pg_catalog.date_trunc('month', oc.created_at)), 'YYYY-MM')
      end as period_label,
      coalesce(sum(oc.total_paise), 0)::bigint as overstay_paise
    from public.overstay_charges oc
    where oc.created_at between v_from_tz and v_to_tz
    group by 1
  ),
  merged_periods as (
    select
      ps.period_label,
      coalesce(pp.gross_paise, 0) as gross_paise,
      coalesce(pr.refund_paise, 0) as refund_paise,
      (coalesce(pp.gross_paise, 0) - coalesce(pr.refund_paise, 0)) as net_paise,
      coalesce(pp.gst_paise, 0) as gst_paise,
      coalesce(pb.bookings_count, 0) as bookings_count,
      coalesce(pb.cancelled_count, 0) as cancelled_count,
      coalesce(po.overstay_paise, 0) as overstay_paise
    from period_series ps
    left join period_payments pp on pp.period_label = ps.period_label
    left join period_refunds  pr on pr.period_label = ps.period_label
    left join period_bookings pb on pb.period_label = ps.period_label
    left join period_overstay po on po.period_label = ps.period_label
    order by ps.period_label asc
  ),
  slot_type_breakdown as (
    select
      psl.slot_type as slot_type,
      count(b.id)::bigint as bookings_count,
      coalesce(sum(case when p.status in ('succeeded', 'refunded', 'partially_refunded') then p.amount_paise else 0 end), 0)::bigint as gross_paise
    from public.bookings b
    join public.parking_slots psl on psl.id = b.slot_id
    left join public.payments p on p.booking_id = b.id
    where b.created_at between v_from_tz and v_to_tz
    group by psl.slot_type
  )
  select jsonb_build_object(
    'summary', jsonb_build_object(
      'from', v_from_date,
      'to', v_to_date,
      'grouping', p_group,
      'total_gross_paise', coalesce(sum(mp.gross_paise), 0),
      'total_refunds_paise', coalesce(sum(mp.refund_paise), 0),
      'total_net_paise', coalesce(sum(mp.net_paise), 0),
      'total_gst_paise', coalesce(sum(mp.gst_paise), 0),
      'total_bookings_count', coalesce(sum(mp.bookings_count), 0),
      'total_cancelled_count', coalesce(sum(mp.cancelled_count), 0),
      'total_overstay_paise', coalesce(sum(mp.overstay_paise), 0)
    ),
    'periods', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'period', mp_inner.period_label,
            'gross_paise', mp_inner.gross_paise,
            'refunds_paise', mp_inner.refund_paise,
            'net_paise', mp_inner.net_paise,
            'gst_paise', mp_inner.gst_paise,
            'bookings_count', mp_inner.bookings_count,
            'cancelled_count', mp_inner.cancelled_count,
            'overstay_paise', mp_inner.overstay_paise
          ) order by mp_inner.period_label asc
        )
        from merged_periods mp_inner
      ),
      '[]'::jsonb
    ),
    'by_slot_type', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'slot_type', stb.slot_type,
            'bookings_count', stb.bookings_count,
            'gross_paise', stb.gross_paise
          ) order by stb.slot_type asc
        )
        from slot_type_breakdown stb
      ),
      '[]'::jsonb
    )
  ) into v_result
  from merged_periods mp;

  return v_result;
end;
$$;

revoke all on function public.admin_revenue_report(date, date, text) from public, anon;
grant execute on function public.admin_revenue_report(date, date, text) to authenticated;

comment on function public.admin_revenue_report(date, date, text) is
  'Computes historical net revenue breakdown by day/week/month and slot type for Admin Revenue Analytics.';

notify pgrst, 'reload schema';
