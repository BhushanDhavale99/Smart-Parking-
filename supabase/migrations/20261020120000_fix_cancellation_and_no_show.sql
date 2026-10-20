-- ============================================================================
-- Migration: 20261020120000_fix_cancellation_and_no_show.sql
-- Description: Unused booking expiry (no_show), cancellation guards for
--              started/ongoing sessions, slot release, and refund integrity.
-- ============================================================================

-- ── 1. EXPIRE UNUSED BOOKINGS FUNCTION ────────────────────────────
-- Automatically transitions bookings whose start time has passed without entry
-- to 'no_show', frees the slot exclusion, and cancels pending sessions.
create or replace function public.expire_unused_bookings()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int := 0;
begin
  -- 1. Mark past unused bookings as 'no_show'
  with updated as (
    update public.bookings
    set status = 'no_show',
        updated_at = pg_catalog.now()
    where status in ('confirmed', 'reserved')
      and start_at < pg_catalog.now()
      and not exists (
        select 1
        from public.parking_sessions ps
        where ps.booking_id = public.bookings.id
          and (ps.ended_at is not null or ps.status in ('completed', 'auto_ended'))
      )
    returning id
  )
  select count(*) into v_count from updated;

  -- 2. Clean up any un-entered active sessions associated with no-show bookings
  update public.parking_sessions
  set status = 'cancelled',
      updated_at = pg_catalog.now()
  where booking_id in (
    select id from public.bookings where status = 'no_show'
  )
  and status = 'active'
  and ended_at is null;

  return v_count;
end;
$$;

revoke all on function public.expire_unused_bookings() from public, anon;
grant execute on function public.expire_unused_bookings() to authenticated;

-- ── 2. ROBUST CANCEL_BOOKING FUNCTION ────────────────────────────
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
  v_settings record;
  v_hours_until_start numeric;
  v_mins_until_start numeric;
  v_refund int := 0;
  v_pct int := 0;
  v_new_payment_status text;
  v_payment public.payments;
begin
  -- 1. Authentication check
  if v_user_id is null then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  -- 2. Lazily expire any past unused bookings first
  perform public.expire_unused_bookings();
  perform public.expire_stale_holds();

  -- 3. Lock and retrieve the target booking
  select * into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;

  -- 4. Access check (owner or admin)
  if v_booking.user_id <> v_user_id and not public.is_admin() then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  -- 5. Terminal status checks
  if v_booking.status in ('cancelled', 'completed', 'expired', 'no_show') then
    raise exception 'Cannot cancel a booking that is already %', v_booking.status using errcode = 'P0001';
  end if;

  if v_booking.status not in ('reserved', 'confirmed') then
    raise exception 'Only reserved or confirmed bookings can be cancelled' using errcode = 'P0001';
  end if;

  -- 6. Start time check: cancellation allowed ONLY if booking has not started
  if v_booking.start_at <= pg_catalog.now() then
    raise exception 'This booking has already started' using errcode = 'P0001';
  end if;

  -- 7. Parking session check: cannot cancel if a session is ongoing or completed
  if exists (
    select 1
    from public.parking_sessions
    where booking_id = p_booking_id
      and (
        started_at <= pg_catalog.now()
        or ended_at is not null
        or status in ('completed', 'auto_ended')
      )
  ) then
    raise exception 'This booking has an ongoing or completed parking session and cannot be cancelled' using errcode = 'P0001';
  end if;

  -- 8. Cancel any pending future session for this booking
  update public.parking_sessions
  set status = 'cancelled',
      updated_at = pg_catalog.now()
  where booking_id = p_booking_id
    and status = 'active';

  -- 9. Calculate refund tier using pricing_settings
  select * into v_settings from public.pricing_settings where id = true;

  if v_booking.payment_status = 'paid' then
    v_hours_until_start := extract(epoch from (v_booking.start_at - pg_catalog.now())) / 3600.0;
    v_mins_until_start := extract(epoch from (v_booking.start_at - pg_catalog.now())) / 60.0;

    if v_hours_until_start >= v_settings.refund_full_hours then
      v_refund := v_booking.total_paise;
      v_pct := 100;
    elsif v_mins_until_start >= v_settings.refund_partial_minutes then
      v_refund := pg_catalog.round((v_booking.total_paise::numeric * v_settings.partial_refund_bps::numeric) / 10000.0)::int;
      v_pct := (v_settings.partial_refund_bps / 100)::int;
    else
      v_refund := 0;
      v_pct := 0;
    end if;

    if v_refund = v_booking.total_paise then
      v_new_payment_status := 'refunded';
    elsif v_refund > 0 then
      v_new_payment_status := 'partially_refunded';
    else
      v_new_payment_status := 'paid';
    end if;
  else
    v_refund := 0;
    v_pct := 0;
    v_new_payment_status := v_booking.payment_status;
  end if;

  -- 10. Process refund in payment ledger if applicable
  if v_refund > 0 and v_booking.payment_status = 'paid' then
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
        v_refund,
        coalesce(p_reason, 'User cancellation: ' || v_pct || '% refund tier')
      );

      update public.payments
      set status = v_new_payment_status,
          updated_at = pg_catalog.now()
      where id = v_payment.id;
    end if;
  end if;

  -- 11. Transition booking to cancelled (frees the bay exclusion constraint)
  update public.bookings
  set status = 'cancelled',
      cancelled_at = pg_catalog.now(),
      cancellation_reason = p_reason,
      refund_paise = v_refund,
      payment_status = v_new_payment_status,
      updated_at = pg_catalog.now()
  where id = p_booking_id
  returning * into v_booking;

  return v_booking;
end;
$$;

revoke all on function public.cancel_booking(uuid, text) from public, anon;
grant execute on function public.cancel_booking(uuid, text) to authenticated;
