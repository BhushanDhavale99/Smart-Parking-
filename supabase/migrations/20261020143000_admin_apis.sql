-- ============================================================================
-- Migration: 20261020143000_admin_apis.sql
-- Description: Core administration APIs, audit logging, role delegation guards,
--              booking overrides, refund handling, revenue analytics, live session
--              telemetry, and system settings controls.
-- ============================================================================

-- ── 1. ADMIN AUDIT LOG TABLE ────────────────────────────────────────────────
-- Append-only audit trail recording every state-changing administrator action.
-- Direct API inserts/updates are blocked. Reads restricted strictly to admins.
--
-- SAFETY: If the table was created by an earlier partial run without all columns,
-- the ALTER TABLE guards below will add any missing columns idempotently.

create table if not exists public.admin_audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid not null,
  action      text not null,
  record_type text not null,
  record_id   text not null default '',
  reason      text not null default '',
  old_data    jsonb,
  new_data    jsonb,
  created_at  timestamptz not null default now()
);

-- Idempotent column guards: add any columns that may be missing from a prior partial run
alter table public.admin_audit_log
  add column if not exists actor_id    uuid;
alter table public.admin_audit_log
  add column if not exists action      text;
alter table public.admin_audit_log
  add column if not exists record_type text;
alter table public.admin_audit_log
  add column if not exists record_id   text not null default '';
alter table public.admin_audit_log
  add column if not exists reason      text not null default '';
alter table public.admin_audit_log
  add column if not exists old_data    jsonb;
alter table public.admin_audit_log
  add column if not exists new_data    jsonb;
alter table public.admin_audit_log
  add column if not exists created_at  timestamptz not null default now();

-- Enforce CHECK constraints and FK (using DO block so they're safe to re-run)
do $$
begin
  -- Foreign key on actor_id
  if not exists (
    select 1 from pg_constraint
    where conname = 'admin_audit_log_actor_id_fkey'
      and conrelid = 'public.admin_audit_log'::regclass
  ) then
    alter table public.admin_audit_log
      add constraint admin_audit_log_actor_id_fkey
      foreign key (actor_id) references auth.users(id) on delete restrict;
  end if;

  -- CHECK on action length
  if not exists (
    select 1 from pg_constraint
    where conname = 'admin_audit_log_action_check'
      and conrelid = 'public.admin_audit_log'::regclass
  ) then
    alter table public.admin_audit_log
      add constraint admin_audit_log_action_check
      check (length(action) between 3 and 100);
  end if;

  -- CHECK on record_type values
  if not exists (
    select 1 from pg_constraint
    where conname = 'admin_audit_log_record_type_check'
      and conrelid = 'public.admin_audit_log'::regclass
  ) then
    alter table public.admin_audit_log
      add constraint admin_audit_log_record_type_check
      check (record_type in ('booking', 'user', 'payment', 'settings'));
  end if;

  -- CHECK on reason length
  if not exists (
    select 1 from pg_constraint
    where conname = 'admin_audit_log_reason_check'
      and conrelid = 'public.admin_audit_log'::regclass
  ) then
    alter table public.admin_audit_log
      add constraint admin_audit_log_reason_check
      check (length(trim(reason)) between 5 and 300);
  end if;
end;
$$;

comment on table public.admin_audit_log is
  'Append-only immutable audit trail for administrative operations.';

create index if not exists idx_admin_audit_log_actor
  on public.admin_audit_log (actor_id, created_at desc);

create index if not exists idx_admin_audit_log_record
  on public.admin_audit_log (record_type, record_id, created_at desc);

create index if not exists idx_admin_audit_log_created
  on public.admin_audit_log (created_at desc);

alter table public.admin_audit_log enable row level security;

-- Admin-only select policy; no insert/update/delete policies for client roles
drop policy if exists "Admins can view audit logs" on public.admin_audit_log;
create policy "Admins can view audit logs"
  on public.admin_audit_log for select to authenticated
  using (public.is_admin());

-- ── 2. ROLE MODIFICATION GUARD & FUNCTION ────────────────────────────────────
-- The existing profiles_prevent_role_change trigger ensures that role changes
-- cannot be performed via direct PostgREST table updates.
-- Here we enhance the trigger function to allow role updates ONLY when an in-memory
-- transaction-scoped setting ('app.allow_role_change' = 'true') is explicitly set.
-- PostgREST clients cannot set transaction configuration directly, guaranteeing
-- that only the privileged security-definer admin_set_user_role function can change roles.

create or replace function public.prevent_role_change_via_api()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- If transaction-scoped flag is set by admin_set_user_role, allow the change
  if current_setting('app.allow_role_change', true) = 'true' then
    return new;
  end if;

  -- Block any direct role modifications originating from client API requests
  if auth.uid() is not null and new.role <> old.role then
    raise exception
      'Role changes are not allowed through the direct API. Use admin_set_user_role.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

create or replace function public.admin_set_user_role(
  p_user_id uuid,
  p_role    text,
  p_reason  text
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id   uuid := auth.uid();
  v_target_user public.profiles;
  v_old_role    text;
  v_admin_count int;
  v_trimmed_reason text;
begin
  -- 1. Authentication & admin check
  if v_caller_id is null or not public.is_admin() then
    raise exception 'Access denied: administrator privileges required' using errcode = '42501';
  end if;

  -- 2. Validate reason length (5-300 chars)
  v_trimmed_reason := trim(coalesce(p_reason, ''));
  if length(v_trimmed_reason) < 5 or length(v_trimmed_reason) > 300 then
    raise exception 'A valid reason between 5 and 300 characters is required' using errcode = 'P0001';
  end if;

  -- 3. Validate target role
  if p_role not in ('member', 'staff', 'admin') then
    raise exception 'Invalid role: must be member, staff, or admin' using errcode = 'P0001';
  end if;

  -- 4. An admin cannot change their own role
  if p_user_id = v_caller_id then
    raise exception 'Administrators cannot alter their own access role' using errcode = 'P0001';
  end if;

  -- 5. Lock and retrieve target profile
  select * into v_target_user
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception 'User profile not found' using errcode = 'P0002';
  end if;

  v_old_role := v_target_user.role;
  if v_old_role = p_role then
    return v_target_user;
  end if;

  -- 6. Last admin demotion guard: prevent demoting the last remaining admin
  if v_old_role = 'admin' and p_role <> 'admin' then
    select count(*) into v_admin_count
    from public.profiles
    where role = 'admin';

    if v_admin_count <= 1 then
      raise exception 'Operation rejected: cannot demote the last remaining administrator' using errcode = 'P0001';
    end if;
  end if;

  -- 7. Set transaction-local flag so profiles_prevent_role_change allows this update
  perform pg_catalog.set_config('app.allow_role_change', 'true', true);

  update public.profiles
  set role = p_role,
      updated_at = pg_catalog.now()
  where id = p_user_id
  returning * into v_target_user;

  -- 8. Write audit log
  insert into public.admin_audit_log (
    actor_id, action, record_type, record_id, reason, old_data, new_data
  ) values (
    v_caller_id,
    'change_user_role',
    'user',
    p_user_id::text,
    v_trimmed_reason,
    jsonb_build_object('role', v_old_role),
    jsonb_build_object('role', p_role)
  );

  return v_target_user;
end;
$$;

-- ── 3. ADMIN LIST USERS ─────────────────────────────────────────────────────
-- Returns comprehensive user profiles including auth emails, booking stats,
-- and total revenue contributed.
create or replace function public.admin_list_users(
  p_search text default null,
  p_role   text default null,
  p_limit  int  default 20,
  p_offset int  default 0
)
returns table (
  id              uuid,
  email           text,
  full_name       text,
  phone           text,
  role            text,
  created_at      timestamptz,
  last_sign_in_at timestamptz,
  booking_count   bigint,
  total_paid_paise bigint,
  total_count     bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id uuid := auth.uid();
  v_limit     int  := least(greatest(1, coalesce(p_limit, 20)), 50);
  v_offset    int  := greatest(0, coalesce(p_offset, 0));
  v_trimmed   text := trim(coalesce(p_search, ''));
begin
  if v_caller_id is null or not public.is_admin() then
    raise exception 'Access denied: administrator privileges required' using errcode = '42501';
  end if;

  return query
  with filtered_users as (
    select
      p.id,
      u.email::text as email,
      p.full_name,
      p.phone,
      p.role,
      p.created_at,
      u.last_sign_in_at,
      coalesce(b_stats.b_count, 0) as booking_count,
      coalesce(p_stats.paid_paise, 0) as total_paid_paise
    from public.profiles p
    join auth.users u on u.id = p.id
    left join (
      select user_id, count(*)::bigint as b_count
      from public.bookings
      group by user_id
    ) b_stats on b_stats.user_id = p.id
    left join (
      select user_id, sum(amount_paise)::bigint as paid_paise
      from public.payments
      where status in ('succeeded', 'refunded', 'partially_refunded')
      group by user_id
    ) p_stats on p_stats.user_id = p.id
    where (p_role is null or p_role = 'All' or p.role = p_role)
      and (
        v_trimmed = ''
        or p.full_name ilike '%' || v_trimmed || '%'
        or p.phone     ilike '%' || v_trimmed || '%'
        or u.email     ilike '%' || v_trimmed || '%'
      )
  ),
  counted as (
    select count(*) as total_rows from filtered_users
  )
  select
    fu.id,
    fu.email,
    fu.full_name,
    fu.phone,
    fu.role,
    fu.created_at,
    fu.last_sign_in_at,
    fu.booking_count,
    fu.total_paid_paise,
    c.total_rows as total_count
  from filtered_users fu
  cross join counted c
  order by fu.created_at desc
  limit v_limit offset v_offset;
end;
$$;

-- ── 4. ADMIN OVERRIDE BOOKING ───────────────────────────────────────────────
-- Allows administrators to intervene on active/reserved/confirmed bookings.
-- Actions: cancel_full_refund, cancel_by_policy, cancel_no_refund, mark_no_show.
create or replace function public.admin_override_booking(
  p_booking_id uuid,
  p_action     text,
  p_reason     text
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id          uuid := auth.uid();
  v_booking            public.bookings;
  v_payment            public.payments;
  v_settings           public.pricing_settings;
  v_refund_paise       int := 0;
  v_refund_reason      text;
  v_existing_refunds   int := 0;
  v_remaining_paid     int := 0;
  v_trimmed_reason     text;
  v_hours_until_start  numeric;
  v_mins_until_start   numeric;
  v_now                timestamptz := pg_catalog.now();
  v_old_status         text;
  v_old_payment_status text;
begin
  -- 1. Security check
  if v_caller_id is null or not public.is_admin() then
    raise exception 'Access denied: administrator privileges required' using errcode = '42501';
  end if;

  -- 2. Validate reason
  v_trimmed_reason := trim(coalesce(p_reason, ''));
  if length(v_trimmed_reason) < 5 or length(v_trimmed_reason) > 300 then
    raise exception 'A valid reason between 5 and 300 characters is required' using errcode = 'P0001';
  end if;

  -- 3. Validate action
  if p_action not in ('cancel_full_refund', 'cancel_by_policy', 'cancel_no_refund', 'mark_no_show') then
    raise exception 'Invalid override action: must be cancel_full_refund, cancel_by_policy, cancel_no_refund, or mark_no_show' using errcode = 'P0001';
  end if;

  -- 4. Lock booking
  select * into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;

  v_old_status := v_booking.status;
  v_old_payment_status := v_booking.payment_status;

  -- 5. Terminal status guard: completed, cancelled, no_show cannot be overridden
  if v_booking.status in ('completed', 'cancelled', 'no_show', 'expired') then
    raise exception 'Cannot override a booking that is already %', v_booking.status using errcode = 'P0001';
  end if;

  -- 6. Lock associated payment if one exists
  select * into v_payment
  from public.payments
  where booking_id = p_booking_id
    and status in ('succeeded', 'partially_refunded')
  for update;

  if found then
    select coalesce(sum(amount_paise), 0) into v_existing_refunds
    from public.payment_refunds
    where payment_id = v_payment.id;

    v_remaining_paid := greatest(0, v_payment.amount_paise - v_existing_refunds);
  end if;

  -- 7. Execute override branch
  if p_action = 'mark_no_show' then
    -- No-show: frees the slot, leaves payment as-is
    update public.bookings
    set status = 'no_show',
        updated_at = v_now
    where id = p_booking_id
    returning * into v_booking;

    -- Cancel any active/pending session
    update public.parking_sessions
    set status = 'cancelled',
        ended_at = coalesce(ended_at, v_now),
        ended_by_admin = true,
        updated_at = v_now
    where booking_id = p_booking_id
      and status = 'active'
      and ended_at is null;

  else
    -- Cancellation actions (cancel_full_refund, cancel_by_policy, cancel_no_refund)
    select * into v_settings from public.pricing_settings where id = true;

    if p_action = 'cancel_full_refund' then
      v_refund_paise := v_remaining_paid;
      v_refund_reason := 'Admin override: full refund (' || v_trimmed_reason || ')';
    elsif p_action = 'cancel_no_refund' then
      v_refund_paise := 0;
      v_refund_reason := 'Admin override: no refund (' || v_trimmed_reason || ')';
    elsif p_action = 'cancel_by_policy' then
      if v_booking.start_at > v_now and v_remaining_paid > 0 then
        v_hours_until_start := extract(epoch from (v_booking.start_at - v_now)) / 3600.0;
        v_mins_until_start  := extract(epoch from (v_booking.start_at - v_now)) / 60.0;

        if v_hours_until_start >= v_settings.refund_full_hours then
          v_refund_paise := v_remaining_paid;
        elsif v_mins_until_start >= v_settings.refund_partial_minutes then
          v_refund_paise := pg_catalog.round((v_booking.total_paise::numeric * v_settings.partial_refund_bps::numeric) / 10000.0)::int;
          v_refund_paise := least(v_refund_paise, v_remaining_paid);
        else
          v_refund_paise := 0;
        end if;
      else
        v_refund_paise := 0;
      end if;
      v_refund_reason := 'Admin override: cancellation policy (' || v_trimmed_reason || ')';
    end if;

    -- Record refund ledger entry if refund is positive
    if v_refund_paise > 0 and v_payment.id is not null then
      insert into public.payment_refunds (
        payment_id,
        booking_id,
        amount_paise,
        reason
      ) values (
        v_payment.id,
        p_booking_id,
        v_refund_paise,
        v_refund_reason
      );

      -- Update payment status
      update public.payments
      set status = case
            when (v_existing_refunds + v_refund_paise) >= v_payment.amount_paise then 'refunded'
            else 'partially_refunded'
          end,
          updated_at = v_now
      where id = v_payment.id;
    end if;

    -- Update booking status and refund aggregate
    update public.bookings
    set status = 'cancelled',
        cancelled_at = v_now,
        cancellation_reason = 'Admin override: ' || v_trimmed_reason,
        refund_paise = coalesce(refund_paise, 0) + v_refund_paise,
        payment_status = case
          when v_payment.id is null then v_booking.payment_status
          when (v_existing_refunds + v_refund_paise) >= v_payment.amount_paise then 'refunded'
          when (v_existing_refunds + v_refund_paise) > 0 then 'partially_refunded'
          else v_booking.payment_status
        end,
        updated_at = v_now
    where id = p_booking_id
    returning * into v_booking;

    -- Cancel associated parking session
    update public.parking_sessions
    set status = 'cancelled',
        ended_at = coalesce(ended_at, v_now),
        ended_by_admin = true,
        updated_at = v_now
    where booking_id = p_booking_id
      and status = 'active'
      and ended_at is null;
  end if;

  -- 8. Write audit log
  insert into public.admin_audit_log (
    actor_id, action, record_type, record_id, reason, old_data, new_data
  ) values (
    v_caller_id,
    'override_booking_' || p_action,
    'booking',
    p_booking_id::text,
    v_trimmed_reason,
    jsonb_build_object(
      'status', v_old_status,
      'payment_status', v_old_payment_status
    ),
    jsonb_build_object(
      'status', v_booking.status,
      'payment_status', v_booking.payment_status,
      'refund_paise', v_refund_paise
    )
  );

  return v_booking;
end;
$$;

-- ── 5. ADMIN REFUND PAYMENT ─────────────────────────────────────────────────
-- Enables manual administrative refunds against existing payments.
create or replace function public.admin_refund_payment(
  p_payment_id    uuid,
  p_amount_paise  int,
  p_reason        text
)
returns public.payment_refunds
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id        uuid := auth.uid();
  v_payment          public.payments;
  v_booking          public.bookings;
  v_existing_refunds int := 0;
  v_remaining_paid   int := 0;
  v_new_total_refund int := 0;
  v_trimmed_reason   text;
  v_refund_row       public.payment_refunds;
  v_now              timestamptz := pg_catalog.now();
  v_old_payment_status text;
begin
  -- 1. Security check
  if v_caller_id is null or not public.is_admin() then
    raise exception 'Access denied: administrator privileges required' using errcode = '42501';
  end if;

  -- 2. Validate reason
  v_trimmed_reason := trim(coalesce(p_reason, ''));
  if length(v_trimmed_reason) < 5 or length(v_trimmed_reason) > 300 then
    raise exception 'A valid reason between 5 and 300 characters is required' using errcode = 'P0001';
  end if;

  -- 3. Lock payment row
  select * into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'Payment transaction not found' using errcode = 'P0002';
  end if;

  v_old_payment_status := v_payment.status;

  if v_payment.status not in ('succeeded', 'partially_refunded') then
    raise exception 'Payment cannot be refunded in current status: %', v_payment.status using errcode = 'P0001';
  end if;

  -- 4. Calculate existing refund sums
  select coalesce(sum(amount_paise), 0) into v_existing_refunds
  from public.payment_refunds
  where payment_id = p_payment_id;

  v_remaining_paid := v_payment.amount_paise - v_existing_refunds;

  if v_remaining_paid <= 0 then
    raise exception 'Payment has already been fully refunded' using errcode = 'P0001';
  end if;

  if p_amount_paise < 1 or p_amount_paise > v_remaining_paid then
    raise exception 'Refund amount must be between 1 and % paise', v_remaining_paid using errcode = 'P0001';
  end if;

  -- GATEWAY HANDOFF: In live production with Razorpay, invoke payment gateway refund API here
  -- e.g. razorpay.payments.refund(v_payment.provider_ref, { amount: p_amount_paise })
  -- For mock payments, ledger entry is authoritative.

  -- 5. Insert refund record
  insert into public.payment_refunds (
    payment_id,
    booking_id,
    amount_paise,
    reason
  ) values (
    v_payment.id,
    v_payment.booking_id,
    p_amount_paise,
    v_trimmed_reason
  )
  returning * into v_refund_row;

  v_new_total_refund := v_existing_refunds + p_amount_paise;

  -- 6. Update payment ledger status
  update public.payments
  set status = case
        when v_new_total_refund >= v_payment.amount_paise then 'refunded'
        else 'partially_refunded'
      end,
      updated_at = v_now
  where id = v_payment.id;

  -- 7. Update booking financial snapshot
  update public.bookings
  set refund_paise = coalesce(refund_paise, 0) + p_amount_paise,
      payment_status = case
        when v_new_total_refund >= v_payment.amount_paise then 'refunded'
        else 'partially_refunded'
      end,
      updated_at = v_now
  where id = v_payment.booking_id;

  -- 8. Write audit log
  insert into public.admin_audit_log (
    actor_id, action, record_type, record_id, reason, old_data, new_data
  ) values (
    v_caller_id,
    'refund_payment',
    'payment',
    p_payment_id::text,
    v_trimmed_reason,
    jsonb_build_object(
      'status', v_old_payment_status,
      'amount_paise', v_payment.amount_paise,
      'refunded_previously', v_existing_refunds
    ),
    jsonb_build_object(
      'refund_id', v_refund_row.id,
      'amount_paise', p_amount_paise,
      'total_refunded', v_new_total_refund
    )
  );

  return v_refund_row;
end;
$$;

-- ── 6. ADMIN REVENUE REPORT ─────────────────────────────────────────────────
-- Comprehensive revenue reporting aggregated by business periods in IST.
create or replace function public.admin_revenue_report(
  p_from  date,
  p_to    date,
  p_group text default 'day'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id         uuid := auth.uid();
  v_diff_days         int;
  v_result            jsonb;
  v_from_tz           timestamptz;
  v_to_tz             timestamptz;
begin
  -- 1. Security check
  if v_caller_id is null or not public.is_admin() then
    raise exception 'Access denied: administrator privileges required' using errcode = '42501';
  end if;

  -- 2. Validate date range and grouping
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'Invalid date range: start date must be before end date' using errcode = 'P0001';
  end if;

  v_diff_days := (p_to - p_from);
  if v_diff_days > 366 then
    raise exception 'Date range exceeds maximum limit of 366 days' using errcode = 'P0001';
  end if;

  if p_group not in ('day', 'week', 'month') then
    raise exception 'Invalid grouping: must be day, week, or month' using errcode = 'P0001';
  end if;

  -- Interpret inputs in Asia/Kolkata timezone
  v_from_tz := (p_from::text || ' 00:00:00 Asia/Kolkata')::timestamptz;
  v_to_tz   := (p_to::text   || ' 23:59:59.999999 Asia/Kolkata')::timestamptz;

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
      psl.type as slot_type,
      count(b.id)::bigint as bookings_count,
      coalesce(sum(case when p.status in ('succeeded', 'refunded', 'partially_refunded') then p.amount_paise else 0 end), 0)::bigint as gross_paise
    from public.bookings b
    join public.parking_slots psl on psl.id = b.slot_id
    left join public.payments p on p.booking_id = b.id
    where b.created_at between v_from_tz and v_to_tz
    group by psl.type
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

-- ── 7. ADMIN ACTIVE SESSIONS MONITORING ─────────────────────────────────────
-- Provides real-time view of ongoing parking sessions and active overstays.
create or replace function public.admin_active_sessions()
returns table (
  session_id            uuid,
  booking_id            uuid,
  booking_reference     text,
  slot_code             text,
  level_code            text,
  plate_snapshot        text,
  user_full_name        text,
  started_at            timestamptz,
  booked_end_at         timestamptz,
  overstay_minutes      int,
  overstay_charge_paise int,
  is_overstay           boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id uuid := auth.uid();
  v_now       timestamptz := pg_catalog.now();
  v_grace_min int;
begin
  if v_caller_id is null or not public.is_admin() then
    raise exception 'Access denied: administrator privileges required' using errcode = '42501';
  end if;

  select exit_grace_minutes into v_grace_min from public.pricing_settings where id = true;
  v_grace_min := coalesce(v_grace_min, 15);

  return query
  select
    ps.id as session_id,
    ps.booking_id,
    b.reference as booking_reference,
    sl.code as slot_code,
    sl.level_code,
    b.plate_snapshot,
    pr.full_name as user_full_name,
    ps.started_at,
    ps.booked_end_at,
    greatest(0, pg_catalog.ceil(extract(epoch from (v_now - ps.booked_end_at)) / 60.0)::int - v_grace_min) as overstay_minutes,
    case
      when v_now > (ps.booked_end_at + (v_grace_min || ' minutes')::interval) then
        pg_catalog.ceil(
          greatest(0, pg_catalog.ceil(extract(epoch from (v_now - ps.booked_end_at)) / 60.0)::int - v_grace_min)::numeric *
          b.hourly_rate_paise / 60.0
        )::int
      else 0
    end as overstay_charge_paise,
    (v_now > ps.booked_end_at) as is_overstay
  from public.parking_sessions ps
  join public.bookings b on b.id = ps.booking_id
  join public.parking_slots sl on sl.id = b.slot_id
  left join public.profiles pr on pr.id = ps.user_id
  where ps.status = 'active'
    and ps.ended_at is null
  order by (v_now - ps.booked_end_at) desc;
end;
$$;

-- ── 8. ADMIN UPDATE SETTINGS ────────────────────────────────────────────────
-- Updates facility operating thresholds and cancellation rules with strict bound checks.
-- Note: payment_mode is intentionally omitted from user modification.
create or replace function public.admin_update_settings(
  p_gst_bps                 int,
  p_hold_minutes            int,
  p_min_hours               int,
  p_max_hours               int,
  p_max_advance_days        int,
  p_refund_full_hours       int,
  p_refund_partial_minutes  int,
  p_partial_refund_bps      int,
  p_exit_grace_minutes      int,
  p_reason                  text
)
returns public.pricing_settings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id      uuid := auth.uid();
  v_old_settings   public.pricing_settings;
  v_new_settings   public.pricing_settings;
  v_trimmed_reason text;
  v_now            timestamptz := pg_catalog.now();
begin
  -- 1. Security check
  if v_caller_id is null or not public.is_admin() then
    raise exception 'Access denied: administrator privileges required' using errcode = '42501';
  end if;

  -- 2. Validate reason
  v_trimmed_reason := trim(coalesce(p_reason, ''));
  if length(v_trimmed_reason) < 5 or length(v_trimmed_reason) > 300 then
    raise exception 'A valid reason between 5 and 300 characters is required' using errcode = 'P0001';
  end if;

  -- 3. Strict range validation
  if p_gst_bps < 0 or p_gst_bps > 2800 then
    raise exception 'GST basis points must be between 0 and 2800 (0%% to 28%%)' using errcode = 'P0001';
  end if;

  if p_hold_minutes < 5 or p_hold_minutes > 30 then
    raise exception 'Hold duration must be between 5 and 30 minutes' using errcode = 'P0001';
  end if;

  if p_min_hours < 1 or p_min_hours > 4 then
    raise exception 'Minimum booking hours must be between 1 and 4' using errcode = 'P0001';
  end if;

  if p_max_hours < 1 or p_max_hours > 72 or p_max_hours < p_min_hours then
    raise exception 'Maximum booking hours must be between min_hours and 72' using errcode = 'P0001';
  end if;

  if p_max_advance_days < 1 or p_max_advance_days > 90 then
    raise exception 'Maximum advance booking days must be between 1 and 90' using errcode = 'P0001';
  end if;

  if p_refund_full_hours < 0 or p_refund_full_hours > 48 then
    raise exception 'Full refund threshold must be between 0 and 48 hours' using errcode = 'P0001';
  end if;

  if p_refund_partial_minutes < 0 or p_refund_partial_minutes > 1440 then
    raise exception 'Partial refund threshold must be between 0 and 1440 minutes' using errcode = 'P0001';
  end if;

  if p_partial_refund_bps < 0 or p_partial_refund_bps > 10000 then
    raise exception 'Partial refund percentage must be between 0 and 10000 bps (0%% to 100%%)' using errcode = 'P0001';
  end if;

  if p_exit_grace_minutes < 0 or p_exit_grace_minutes > 120 then
    raise exception 'Exit grace duration must be between 0 and 120 minutes' using errcode = 'P0001';
  end if;

  -- 4. Lock settings singleton
  select * into v_old_settings
  from public.pricing_settings
  where id = true
  for update;

  -- 5. Apply updates
  update public.pricing_settings
  set gst_bps                = p_gst_bps,
      hold_minutes           = p_hold_minutes,
      min_hours              = p_min_hours,
      max_hours              = p_max_hours,
      max_advance_days       = p_max_advance_days,
      refund_full_hours      = p_refund_full_hours,
      refund_partial_minutes = p_refund_partial_minutes,
      partial_refund_bps     = p_partial_refund_bps,
      exit_grace_minutes     = p_exit_grace_minutes,
      updated_at             = v_now
  where id = true
  returning * into v_new_settings;

  -- 6. Write audit log
  insert into public.admin_audit_log (
    actor_id, action, record_type, record_id, reason, old_data, new_data
  ) values (
    v_caller_id,
    'update_pricing_settings',
    'settings',
    'singleton',
    v_trimmed_reason,
    to_jsonb(v_old_settings),
    to_jsonb(v_new_settings)
  );

  return v_new_settings;
end;
$$;

-- ── 9. ACCESS CONTROL / GRANTS ──────────────────────────────────────────────
revoke execute on function public.prevent_role_change_via_api()            from public, anon;
revoke execute on function public.admin_set_user_role(uuid, text, text)     from public, anon;
grant  execute on function public.admin_set_user_role(uuid, text, text)     to authenticated;

revoke execute on function public.admin_list_users(text, text, int, int)    from public, anon;
grant  execute on function public.admin_list_users(text, text, int, int)    to authenticated;

revoke execute on function public.admin_override_booking(uuid, text, text)  from public, anon;
grant  execute on function public.admin_override_booking(uuid, text, text)  to authenticated;

revoke execute on function public.admin_refund_payment(uuid, int, text)     from public, anon;
grant  execute on function public.admin_refund_payment(uuid, int, text)     to authenticated;

revoke execute on function public.admin_revenue_report(date, date, text)    from public, anon;
grant  execute on function public.admin_revenue_report(date, date, text)    to authenticated;

revoke execute on function public.admin_active_sessions()                   from public, anon;
grant  execute on function public.admin_active_sessions()                   to authenticated;

revoke execute on function public.admin_update_settings(int, int, int, int, int, int, int, int, int, text) from public, anon;
grant  execute on function public.admin_update_settings(int, int, int, int, int, int, int, int, int, text) to authenticated;
