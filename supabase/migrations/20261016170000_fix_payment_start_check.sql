-- Migration: 20261016170000_fix_payment_start_check.sql
-- Description: Refine past-start and hold validation for bookings & payments
-- 1. Start-time grace check applies ONLY on INSERT inside create_booking, never on UPDATE or in pay_for_booking.
-- 2. pay_for_booking permits payment while hold is valid (hold_expires_at > now()) and booking has not ended (end_at > now()).
-- 3. Failed payment attempts count only provider declines (decline, insufficient_funds, timeout). Internal/validation errors do not count.

-- ── 1. UPDATE pay_for_booking FUNCTION ────────────────────────────
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

  -- Hold validity check: hold must not be expired
  if v_booking.hold_expires_at is not null and v_booking.hold_expires_at <= pg_catalog.now() then
    raise exception 'Reservation hold has expired. Please select a space again.' using errcode = 'P0001';
  end if;

  -- End time check: booking period must not have already elapsed
  if v_booking.end_at <= pg_catalog.now() then
    raise exception 'Booking period has already ended. Please select a new time.' using errcode = 'P0001';
  end if;

  if v_booking.payment_status not in ('pending', 'failed') then
    raise exception 'Booking payment status must be pending or failed (current: %)', v_booking.payment_status using errcode = 'P0001';
  end if;

  -- 5. Validate pricing settings and count real provider declined attempts only
  select * into v_settings from public.pricing_settings where id = true;

  select count(*) into v_failed_attempts
  from public.payments
  where booking_id = p_booking_id
    and status = 'failed'
    and failure_reason in (
      'Card or transaction was declined by issuing bank.',
      'Insufficient account balance or credit limit.',
      'Payment gateway session timed out waiting for authorization.'
    );

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
    -- Real gateway simulation declines: only these insert a failed payment row
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

-- ── 2. ENSURE IMMUTABILITY TRIGGER ON BOOKINGS IS UPDATE-ONLY ───
-- Verifies that start_at < now() is never evaluated during booking updates
create or replace function public.protect_booking_immutability()
returns trigger
language plpgsql
as $$
begin
  if old.user_id <> new.user_id
     or old.slot_id <> new.slot_id
     or old.vehicle_id <> new.vehicle_id
     or old.start_at <> new.start_at
     or old.end_at <> new.end_at
     or old.reference <> new.reference
     or old.base_paise <> new.base_paise
     or old.gst_paise <> new.gst_paise
     or old.total_paise <> new.total_paise
  then
    raise exception 'Booking parameters and pricing are immutable after creation' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
