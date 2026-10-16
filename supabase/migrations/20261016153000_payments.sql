-- ============================================================================
-- Migration: 20261016153000_payments.sql
-- Description: Real mock payment flow, receipts, immutable ledger, refunds on
--              cancellation, and removal of temporary dev_confirm_booking.
-- ============================================================================

-- ── 1. PRICING SETTINGS EXTENSIONS ──────────────────────────────
-- Add payment gateway operation mode and maximum retry attempts
alter table public.pricing_settings
  add column if not exists payment_mode text not null default 'mock'
    check (payment_mode in ('mock', 'razorpay')),
  add column if not exists max_payment_attempts int not null default 3
    check (max_payment_attempts >= 1);

comment on column public.pricing_settings.payment_mode is
  'Active payment provider mode: "mock" (in-database simulated gateway) or "razorpay" (live gateway).';
comment on column public.pricing_settings.max_payment_attempts is
  'Maximum number of failed payment attempts permitted per reserved booking.';

-- ── 2. PAYMENTS TABLE ───────────────────────────────────────────
-- Append-only financial ledger of all customer payment attempts
create table if not exists public.payments (
  id               uuid primary key default gen_random_uuid(),
  booking_id       uuid not null references public.bookings(id) on delete restrict,
  user_id          uuid not null references auth.users(id) on delete restrict,
  provider         text not null default 'mock',
  provider_ref     text,
  method           text not null check (method in ('upi', 'card', 'netbanking', 'wallet')),
  amount_paise     int not null check (amount_paise > 0),
  base_paise       int not null check (base_paise >= 0),
  gst_paise        int not null check (gst_paise >= 0),
  currency         text not null default 'INR',
  status           text not null check (status in ('succeeded', 'failed', 'refunded', 'partially_refunded')),
  failure_reason   text,
  receipt_number   text unique,
  idempotency_key  text not null unique,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.payments is
  'Customer payment transactions with server-calculated amounts, idempotency keys, and receipt identifiers.';

-- Partial unique index: A booking may have at most one successful/active payment
create unique index if not exists idx_payments_booking_succeeded
  on public.payments (booking_id)
  where (status in ('succeeded', 'refunded', 'partially_refunded'));

-- Query optimization indexes
create index if not exists idx_payments_user_created
  on public.payments (user_id, created_at desc);

create index if not exists idx_payments_booking_id
  on public.payments (booking_id);

create index if not exists idx_payments_status
  on public.payments (status);

create index if not exists idx_payments_created_at
  on public.payments (created_at desc);

-- ── 3. PAYMENT_REFUNDS TABLE ────────────────────────────────────
-- Audit trail of funds returned to users upon booking cancellation
create table if not exists public.payment_refunds (
  id           uuid primary key default gen_random_uuid(),
  payment_id   uuid not null references public.payments(id) on delete restrict,
  booking_id   uuid not null references public.bookings(id) on delete restrict,
  amount_paise int not null check (amount_paise > 0),
  reason       text,
  created_at   timestamptz not null default now()
);

comment on table public.payment_refunds is
  'Ledger of processed refund amounts associated with original payments and bookings.';

create index if not exists idx_payment_refunds_payment_id
  on public.payment_refunds (payment_id);

create index if not exists idx_payment_refunds_booking_id
  on public.payment_refunds (booking_id);

-- ── 4. ROW LEVEL SECURITY & PERMISSIONS ─────────────────────────
alter table public.payments enable row level security;
alter table public.payment_refunds enable row level security;

-- Revoke all direct modification permissions from authenticated and anon
revoke all on public.payments from anon;
revoke insert, update, delete on public.payments from authenticated;
grant select on public.payments to authenticated;

revoke all on public.payment_refunds from anon;
revoke insert, update, delete on public.payment_refunds from authenticated;
grant select on public.payment_refunds to authenticated;

-- Policies for payments
drop policy if exists "payments_select_policy" on public.payments;
create policy "payments_select_policy"
  on public.payments
  for select
  to authenticated
  using (
    auth.uid() = user_id or public.is_admin()
  );

-- Policies for payment_refunds
drop policy if exists "payment_refunds_select_policy" on public.payment_refunds;
create policy "payment_refunds_select_policy"
  on public.payment_refunds
  for select
  to authenticated
  using (
    exists (
      select 1 from public.payments p
      where p.id = payment_refunds.payment_id
        and (p.user_id = auth.uid() or public.is_admin())
    )
  );

-- ── 5. IMMUTABILITY TRIGGERS ────────────────────────────────────
-- Protect financial figures, user_id, booking_id, and enforce valid status transitions
create or replace function public.protect_payment_immutability()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.id <> old.id or
       new.booking_id <> old.booking_id or
       new.user_id <> old.user_id or
       new.amount_paise <> old.amount_paise or
       new.base_paise <> old.base_paise or
       new.gst_paise <> old.gst_paise or
       new.currency <> old.currency or
       new.idempotency_key <> old.idempotency_key or
       new.created_at <> old.created_at then
      raise exception 'Payment financial values and identities are immutable' using errcode = '42501';
    end if;

    if old.status = 'succeeded' and new.status not in ('succeeded', 'refunded', 'partially_refunded') then
      raise exception 'Illegal payment status transition from % to %', old.status, new.status using errcode = 'P0001';
    end if;

    if old.status in ('refunded', 'failed') and new.status <> old.status then
      raise exception 'Final payment status % cannot be modified', old.status using errcode = 'P0001';
    end if;

    new.updated_at := pg_catalog.now();
    return new;
  end if;

  if tg_op = 'DELETE' then
    raise exception 'Payment records cannot be deleted' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists payments_protect_immutability on public.payments;
create trigger payments_protect_immutability
  before update or delete on public.payments
  for each row
  execute function public.protect_payment_immutability();

-- Payment refunds are strictly append-only
create or replace function public.protect_refund_immutability()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Payment refund records are immutable and cannot be updated or deleted' using errcode = '42501';
end;
$$;

drop trigger if exists payment_refunds_protect_immutability on public.payment_refunds;
create trigger payment_refunds_protect_immutability
  before update or delete on public.payment_refunds
  for each row
  execute function public.protect_refund_immutability();

-- ── 6. RECEIPT NUMBER GENERATOR ─────────────────────────────────
-- Format: RC-YYYYMMDD-XXXX (IST date + 4-char uppercase Crockford Base32)
create or replace function public.generate_receipt_number()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_date text;
  v_chars text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  v_random text;
  v_candidate text;
  v_i int;
  v_attempts int := 0;
begin
  -- Format date in Asia/Kolkata timezone
  v_date := to_char(pg_catalog.timezone('Asia/Kolkata', pg_catalog.now()), 'YYYYMMDD');

  loop
    v_attempts := v_attempts + 1;
    if v_attempts > 100 then
      raise exception 'Failed to generate a unique receipt number after 100 attempts' using errcode = 'P0001';
    end if;

    v_random := '';
    for v_i in 1..4 loop
      v_random := v_random || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
    end loop;

    v_candidate := 'RC-' || v_date || '-' || v_random;

    if not exists (select 1 from public.payments where receipt_number = v_candidate) then
      return v_candidate;
    end if;
  end loop;
end;
$$;

revoke all on function public.generate_receipt_number() from public, anon;
grant execute on function public.generate_receipt_number() to authenticated;

-- ── 7. PAY FOR BOOKING FUNCTION ─────────────────────────────────
-- Atomic payment processor for reservations
create or replace function public.pay_for_booking(
  p_booking_id uuid,
  p_method text,
  p_idempotency_key text,
  p_test_scenario text default 'success'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing_payment public.payments;
  v_booking public.bookings;
  v_settings public.pricing_settings;
  v_failed_attempts int;
  v_receipt_number text;
  v_provider_ref text;
  v_payment public.payments;
  v_failure_reason text;
begin
  -- 1. Authentication check
  if v_user_id is null then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  -- 2. Idempotency check: if already processed for this user, return unchanged
  select * into v_existing_payment
  from public.payments
  where idempotency_key = p_idempotency_key
    and user_id = v_user_id;

  if found then
    select * into v_booking from public.bookings where id = v_existing_payment.booking_id;
    return jsonb_build_object(
      'payment', to_jsonb(v_existing_payment),
      'booking', to_jsonb(v_booking)
    );
  end if;

  -- 3. Expire stale holds before checking availability
  perform public.expire_stale_holds();

  -- 4. Validate booking ownership and status (lock row for update)
  select * into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;

  if v_booking.user_id <> v_user_id then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  if v_booking.status <> 'reserved' then
    raise exception 'Booking is not in reserved status (current status: %)', v_booking.status using errcode = 'P0001';
  end if;

  if v_booking.hold_expires_at is not null and v_booking.hold_expires_at < pg_catalog.now() then
    raise exception 'Reservation hold has expired. Please select a space again.' using errcode = 'P0001';
  end if;

  if v_booking.payment_status not in ('pending', 'failed') then
    raise exception 'Booking payment status must be pending or failed (current: %)', v_booking.payment_status using errcode = 'P0001';
  end if;

  -- 5. Validate pricing settings and payment attempts
  select * into v_settings from public.pricing_settings where id = true;

  select count(*) into v_failed_attempts
  from public.payments
  where booking_id = p_booking_id and status = 'failed';

  if v_failed_attempts >= v_settings.max_payment_attempts then
    raise exception 'Maximum payment attempts (%) exceeded for this reservation', v_settings.max_payment_attempts using errcode = 'P0001';
  end if;

  -- 6. Validate method
  if p_method not in ('upi', 'card', 'netbanking', 'wallet') then
    raise exception 'Invalid payment method: %', p_method using errcode = 'P0001';
  end if;

  -- 7. Payment mode check
  if v_settings.payment_mode <> 'mock' then
    raise exception 'Live payment gateway integration is not configured or not available' using errcode = 'P0001';
  end if;

  -- Validate test scenario in mock mode
  if p_test_scenario not in ('success', 'decline', 'insufficient_funds', 'timeout') then
    raise exception 'Invalid test scenario: %', p_test_scenario using errcode = 'P0001';
  end if;

  -- 8. Execute test scenario
  if p_test_scenario = 'success' then
    v_receipt_number := public.generate_receipt_number();
    v_provider_ref := 'MOCK-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

    insert into public.payments (
      booking_id,
      user_id,
      provider,
      provider_ref,
      method,
      amount_paise,
      base_paise,
      gst_paise,
      currency,
      status,
      failure_reason,
      receipt_number,
      idempotency_key
    ) values (
      v_booking.id,
      v_user_id,
      'mock',
      v_provider_ref,
      p_method,
      v_booking.total_paise,
      v_booking.base_paise,
      v_booking.gst_paise,
      'INR',
      'succeeded',
      null,
      v_receipt_number,
      p_idempotency_key
    )
    returning * into v_payment;

    update public.bookings
    set status = 'confirmed',
        payment_status = 'paid',
        hold_expires_at = null,
        updated_at = pg_catalog.now()
    where id = v_booking.id
    returning * into v_booking;

    return jsonb_build_object(
      'payment', to_jsonb(v_payment),
      'booking', to_jsonb(v_booking)
    );
  else
    if p_test_scenario = 'decline' then
      v_failure_reason := 'Card or transaction was declined by issuing bank.';
    elsif p_test_scenario = 'insufficient_funds' then
      v_failure_reason := 'Insufficient account balance or credit limit.';
    elsif p_test_scenario = 'timeout' then
      v_failure_reason := 'Payment gateway session timed out waiting for authorization.';
    else
      v_failure_reason := 'Payment processing failed.';
    end if;

    insert into public.payments (
      booking_id,
      user_id,
      provider,
      provider_ref,
      method,
      amount_paise,
      base_paise,
      gst_paise,
      currency,
      status,
      failure_reason,
      receipt_number,
      idempotency_key
    ) values (
      v_booking.id,
      v_user_id,
      'mock',
      null,
      p_method,
      v_booking.total_paise,
      v_booking.base_paise,
      v_booking.gst_paise,
      'INR',
      'failed',
      v_failure_reason,
      null,
      p_idempotency_key
    )
    returning * into v_payment;

    update public.bookings
    set payment_status = 'failed',
        updated_at = pg_catalog.now()
    where id = v_booking.id
    returning * into v_booking;

    return jsonb_build_object(
      'payment', to_jsonb(v_payment),
      'booking', to_jsonb(v_booking)
    );
  end if;
end;
$$;

revoke all on function public.pay_for_booking(uuid, text, text, text) from public, anon;
grant execute on function public.pay_for_booking(uuid, text, text, text) to authenticated;

-- ── 8. EXTENDED CANCEL_BOOKING FUNCTION ─────────────────────────
-- Updates booking, inserts refund record, and transitions payment status
create or replace function public.cancel_booking(
  p_booking_id uuid,
  p_reason text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_booking public.bookings;
  v_preview record;
  v_new_payment_status text;
  v_payment public.payments;
begin
  if v_user_id is null then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  select * into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;

  if v_booking.user_id <> v_user_id and not public.is_admin() then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  if v_booking.status in ('cancelled', 'completed', 'expired') then
    raise exception 'Cannot cancel a booking that is already %', v_booking.status using errcode = 'P0001';
  end if;

  select * into v_preview from public.cancellation_preview(p_booking_id);

  if v_booking.payment_status = 'paid' then
    if v_preview.refund_paise = v_booking.total_paise then
      v_new_payment_status := 'refunded';
    elsif v_preview.refund_paise > 0 then
      v_new_payment_status := 'partially_refunded';
    else
      v_new_payment_status := 'paid';
    end if;
  else
    v_new_payment_status := v_booking.payment_status;
  end if;

  -- If a refund is due and a payment row exists, record it and update payment
  if v_preview.refund_paise > 0 and v_booking.payment_status = 'paid' then
    select * into v_payment
    from public.payments
    where booking_id = p_booking_id
      and status in ('succeeded', 'partially_refunded')
    for update;

    if found then
      insert into public.payment_refunds (
        payment_id,
        booking_id,
        amount_paise,
        reason
      ) values (
        v_payment.id,
        p_booking_id,
        v_preview.refund_paise,
        coalesce(p_reason, 'User cancellation: ' || v_preview.refund_percentage || '% refund tier')
      );

      update public.payments
      set status = v_new_payment_status,
          updated_at = pg_catalog.now()
      where id = v_payment.id;
    end if;
  end if;

  update public.bookings
  set status = 'cancelled',
      cancelled_at = pg_catalog.now(),
      cancellation_reason = p_reason,
      refund_paise = v_preview.refund_paise,
      payment_status = v_new_payment_status,
      updated_at = pg_catalog.now()
  where id = p_booking_id
  returning * into v_booking;

  return v_booking;
end;
$$;

revoke all on function public.cancel_booking(uuid, text) from public, anon;
grant execute on function public.cancel_booking(uuid, text) to authenticated;

-- ── 9. REMOVE TEMPORARY DEV_CONFIRM_BOOKING ─────────────────────
drop function if exists public.dev_confirm_booking(uuid);
