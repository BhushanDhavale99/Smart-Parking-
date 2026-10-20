-- ============================================================================
-- ParkGrid One - Fix Admin Revenue Report
-- ============================================================================
-- PURPOSE:
--   1. Fixes column reference from `psl.type` to `psl.slot_type`.
--   2. Defaults null `p_from` / `p_to` to today IST.
--   3. Guarantees integer paise math matching payments ledger totals.
-- ============================================================================

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
      and pr.status = 'processed'
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
    order by gross_paise desc
  ),
  level_breakdown as (
    select
      psl.level_code,
      count(b.id)::bigint as bookings_count,
      coalesce(sum(case when p.status in ('succeeded', 'refunded', 'partially_refunded') then p.amount_paise else 0 end), 0)::bigint as gross_paise
    from public.bookings b
    join public.parking_slots psl on psl.id = b.slot_id
    left join public.payments p on p.booking_id = b.id
    where b.created_at between v_from_tz and v_to_tz
    group by psl.level_code
    order by psl.level_code asc
  ),
  method_breakdown as (
    select
      p.method,
      count(*)::bigint as count,
      coalesce(sum(p.amount_paise), 0)::bigint as gross_paise
    from public.payments p
    where p.created_at between v_from_tz and v_to_tz
      and p.status in ('succeeded', 'refunded', 'partially_refunded')
    group by p.method
    order by gross_paise desc
  )
  select jsonb_build_object(
    'periods', coalesce((select jsonb_agg(to_jsonb(mp)) from merged_periods mp), '[]'::jsonb),
    'totals', jsonb_build_object(
      'total_gross_paise', coalesce((select sum(gross_paise) from merged_periods), 0),
      'total_refund_paise', coalesce((select sum(refund_paise) from merged_periods), 0),
      'total_net_paise', coalesce((select sum(net_paise) from merged_periods), 0),
      'total_gst_paise', coalesce((select sum(gst_paise) from merged_periods), 0),
      'total_bookings', coalesce((select sum(bookings_count) from merged_periods), 0),
      'total_cancelled', coalesce((select sum(cancelled_count) from merged_periods), 0),
      'total_overstay_paise', coalesce((select sum(overstay_paise) from merged_periods), 0),
      'average_booking_value_paise', case
        when coalesce((select sum(bookings_count) from merged_periods), 0) > 0 then
          (coalesce((select sum(gross_paise) from merged_periods), 0) / (select sum(bookings_count) from merged_periods))
        else 0
      end,
      'cancellation_rate_bps', case
        when coalesce((select sum(bookings_count) from merged_periods), 0) > 0 then
          ((coalesce((select sum(cancelled_count) from merged_periods), 0)::numeric * 10000.0) / (select sum(bookings_count) from merged_periods))::int
        else 0
      end
    ),
    'breakdown_by_slot_type', coalesce((select jsonb_agg(to_jsonb(stb)) from slot_type_breakdown stb), '[]'::jsonb),
    'breakdown_by_level', coalesce((select jsonb_agg(to_jsonb(lb)) from level_breakdown lb), '[]'::jsonb),
    'breakdown_by_payment_method', coalesce((select jsonb_agg(to_jsonb(mb)) from method_breakdown mb), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.admin_revenue_report(date, date, text) from public, anon;
grant execute on function public.admin_revenue_report(date, date, text) to authenticated;

-- ── 2. ADMIN PAYMENT TOTALS ──────────────────────────────────────────────────
-- Computes aggregated payment ledger totals directly in SQL for the Admin Payments tab,
-- eliminating client-side row iteration and PostgREST limits.
create or replace function public.admin_payment_totals(
  p_date_from timestamptz default null,
  p_date_to   timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id          uuid := auth.uid();
  v_gross_paise        bigint := 0;
  v_refund_paise       bigint := 0;
  v_succeeded_count    int := 0;
  v_failed_count       int := 0;
  v_total_transactions int := 0;
begin
  if v_caller_id is null or not public.is_admin() then
    raise exception 'Access denied: administrator privileges required' using errcode = '42501';
  end if;

  select
    coalesce(sum(case when status in ('succeeded', 'refunded', 'partially_refunded') then amount_paise else 0 end), 0)::bigint,
    count(case when status in ('succeeded', 'refunded', 'partially_refunded') then 1 end)::int,
    count(case when status = 'failed' then 1 end)::int,
    count(*)::int
  into
    v_gross_paise,
    v_succeeded_count,
    v_failed_count,
    v_total_transactions
  from public.payments
  where (p_date_from is null or created_at >= p_date_from)
    and (p_date_to is null or created_at <= p_date_to);

  select coalesce(sum(pr.amount_paise), 0)::bigint
  into v_refund_paise
  from public.payment_refunds pr
  where pr.status = 'processed'
    and (p_date_from is null or pr.created_at >= p_date_from)
    and (p_date_to is null or pr.created_at <= p_date_to);

  return jsonb_build_object(
    'grossPaise', v_gross_paise,
    'refundPaise', v_refund_paise,
    'netPaise', (v_gross_paise - v_refund_paise),
    'succeededCount', v_succeeded_count,
    'failedCount', v_failed_count,
    'totalTransactions', v_total_transactions
  );
end;
$$;

revoke all on function public.admin_payment_totals(timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_payment_totals(timestamptz, timestamptz) to authenticated;
