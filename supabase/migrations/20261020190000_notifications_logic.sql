-- ============================================================================
-- Migration: 20261020190000_notifications_logic.sql
-- Description:
--   1. Tighten RLS on public.notifications (revoke direct inserts, restrict updates to is_read).
--   2. Internal create_notification() function (SECURITY DEFINER, restricted execution).
--   3. Member helper RPCs: mark_notifications_read, mark_all_notifications_read, unread_notification_count.
--   4. Exception-safe notification triggers on bookings, payments, and parking_sessions.
--   5. Realtime publication check for public.notifications.
--   6. Enforce exactly one active default vehicle per user.
-- ============================================================================

-- ── 1. TIGHTEN RLS ON NOTIFICATIONS ─────────────────────────────────────────
alter table public.notifications enable row level security;

-- Drop all old policies
drop policy if exists "notifications_select_policy" on public.notifications;
drop policy if exists "notifications_insert_policy" on public.notifications;
drop policy if exists "notifications_update_policy" on public.notifications;
drop policy if exists "notifications_delete_policy" on public.notifications;

-- 1a. Members can only SELECT their own rows; Admins can SELECT all
create policy "notifications_select_policy"
  on public.notifications for select to authenticated
  using (auth.uid() = user_id or public.is_admin());

-- 1b. Members can DELETE their own rows; Admins can delete any
create policy "notifications_delete_policy"
  on public.notifications for delete to authenticated
  using (auth.uid() = user_id or public.is_admin());

-- 1c. Members can UPDATE only their own rows
create policy "notifications_update_policy"
  on public.notifications for update to authenticated
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

-- 1d. Restrict direct mutation so members cannot alter title, body, user_id, or metadata
create or replace function public.enforce_notification_read_only_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Admins can update if needed, but members can only change read flags
  if not public.is_admin() then
    if new.id <> old.id or
       new.user_id <> old.user_id or
       new.title <> old.title or
       new.body is distinct from old.body or
       new.message is distinct from old.message or
       new.type <> old.type or
       new.link is distinct from old.link or
       new.created_at <> old.created_at then
      raise exception 'Only read status may be updated on notifications'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notifications_read_only_update on public.notifications;
create trigger trg_notifications_read_only_update
  before update on public.notifications
  for each row execute function public.enforce_notification_read_only_update();

-- 1e. Revoke INSERT from authenticated, anon, and public
revoke all on public.notifications from anon;
revoke insert on public.notifications from authenticated;
revoke insert on public.notifications from public;
grant select, update, delete on public.notifications to authenticated;


-- ── 2. INTERNAL CREATE NOTIFICATION FUNCTION ─────────────────────────────────
-- Restricted internal security-definer function used by database triggers
create or replace function public.create_notification(
  p_user uuid,
  p_type text,
  p_title text,
  p_body text,
  p_link text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_notif_id uuid;
  v_clean_type text := lower(trim(coalesce(p_type, 'system')));
  v_clean_title text;
  v_clean_body text;
begin
  if p_user is null then
    return null;
  end if;

  -- Validate allowed notification types
  if v_clean_type not in ('booking', 'payment', 'session', 'system') then
    v_clean_type := 'system';
  end if;

  -- Truncate title and body to safe limits
  v_clean_title := substring(trim(coalesce(p_title, 'Notification')) from 1 for 120);
  v_clean_body := substring(trim(coalesce(p_body, '')) from 1 for 500);

  insert into public.notifications (
    user_id,
    type,
    title,
    body,
    message,
    link,
    is_read,
    read,
    created_at,
    updated_at
  ) values (
    p_user,
    v_clean_type,
    v_clean_title,
    v_clean_body,
    v_clean_body,
    p_link,
    false,
    false,
    now(),
    now()
  ) returning id into v_notif_id;

  return v_notif_id;
exception
  when others then
    -- Swallow error so calling transaction never aborts
    return null;
end;
$$;

-- Revoke execution from API roles
revoke execute on function public.create_notification(uuid, text, text, text, text) from public, anon, authenticated;


-- ── 3. MEMBER HELPER RPCs ────────────────────────────────────────────────────
-- 3a. Mark specific notifications as read
create or replace function public.mark_notifications_read(p_ids uuid[])
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_count int := 0;
begin
  if v_user_id is null then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  update public.notifications
  set is_read = true, read = true, updated_at = now()
  where user_id = v_user_id
    and id = any(p_ids)
    and is_read = false;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- 3b. Mark all notifications read for the caller
create or replace function public.mark_all_notifications_read()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_count int := 0;
begin
  if v_user_id is null then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  update public.notifications
  set is_read = true, read = true, updated_at = now()
  where user_id = v_user_id
    and is_read = false;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- 3c. Unread count for caller
create or replace function public.unread_notification_count()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_count int := 0;
begin
  if v_user_id is null then
    return 0;
  end if;

  select count(*)::int into v_count
  from public.notifications
  where user_id = v_user_id and is_read = false;

  return v_count;
end;
$$;

-- Grants for member RPCs
revoke execute on function public.mark_notifications_read(uuid[]) from public, anon;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;

revoke execute on function public.mark_all_notifications_read() from public, anon;
grant execute on function public.mark_all_notifications_read() to authenticated;

revoke execute on function public.unread_notification_count() from public, anon;
grant execute on function public.unread_notification_count() to authenticated;


-- ── 4. NOTIFICATION TRIGGERS ─────────────────────────────────────────────────

-- 4a. Bookings Trigger
create or replace function public.trg_bookings_notify_state_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slot_code text;
  v_ist_time text;
  v_title text;
  v_body text;
  v_refund_text text := '';
begin
  -- Only fire on actual status transition
  if old.status is not distinct from new.status then
    return new;
  end if;

  begin
    if new.status = 'confirmed' then
      -- Slot code lookup
      select code into v_slot_code
      from public.parking_slots
      where id = new.slot_id;

      -- Start time formatted in Asia/Kolkata
      v_ist_time := to_char(timezone('Asia/Kolkata', new.start_at), 'DD Mon YYYY, HH12:MI AM');

      v_title := 'Booking confirmed';
      v_body := 'Booking confirmed: slot ' || coalesce(v_slot_code, 'assigned') || ' on ' || v_ist_time || ' IST.';

      perform public.create_notification(new.user_id, 'booking', v_title, v_body, '/bookings');

    elsif new.status = 'cancelled' then
      if new.refund_paise is not null and new.refund_paise > 0 then
        v_refund_text := ' Refund of ₹' || trim(to_char(new.refund_paise / 100.0, '999990.00')) || ' processed.';
      end if;

      if coalesce(new.cancellation_reason, '') ilike '%admin%' then
        v_title := 'Booking cancelled by admin';
        v_body := 'Your booking ' || coalesce(new.reference, '') || ' was cancelled by administrator.' || v_refund_text;
      else
        v_title := 'Booking cancelled';
        v_body := 'Your booking ' || coalesce(new.reference, '') || ' has been cancelled.' || v_refund_text;
      end if;

      perform public.create_notification(new.user_id, 'booking', v_title, v_body, '/bookings');

    elsif new.status = 'no_show' then
      v_title := 'Booking marked as no-show';
      v_body := 'Your booking ' || coalesce(new.reference, '') || ' was marked as no-show.';

      perform public.create_notification(new.user_id, 'booking', v_title, v_body, '/bookings');
    end if;

  exception
    when others then
      -- Swallow any error to ensure original booking update always succeeds
      null;
  end;

  return new;
end;
$$;

drop trigger if exists trg_bookings_notify on public.bookings;
create trigger trg_bookings_notify
  after update of status on public.bookings
  for each row execute function public.trg_bookings_notify_state_change();


-- 4b. Payments Trigger
create or replace function public.trg_payments_notify_state_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
  v_body text;
  v_amount_text text;
begin
  -- Only fire on insert or real status change
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then
    return new;
  end if;

  begin
    v_amount_text := trim(to_char(new.amount_paise / 100.0, '999990.00'));

    if new.status = 'succeeded' then
      v_title := 'Payment successful';
      v_body := 'Payment of ₹' || v_amount_text || ' received (Receipt: ' || coalesce(new.receipt_number, new.id::text) || ').';

      perform public.create_notification(new.user_id, 'payment', v_title, v_body, '/bookings');

    elsif new.status = 'failed' then
      v_title := 'Payment failed';
      v_body := 'Payment of ₹' || v_amount_text || ' failed: ' || coalesce(new.failure_reason, 'Transaction declined');

      perform public.create_notification(new.user_id, 'payment', v_title, v_body, '/bookings');
    end if;

  exception
    when others then
      null;
  end;

  return new;
end;
$$;

drop trigger if exists trg_payments_notify on public.payments;
create trigger trg_payments_notify
  after insert or update of status on public.payments
  for each row execute function public.trg_payments_notify_state_change();


-- 4c. Parking Sessions Trigger
create or replace function public.trg_parking_sessions_notify_state_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
  v_body text;
  v_overstay_paise bigint := 0;
  v_overstay_text text := '';
begin
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then
    return new;
  end if;

  begin
    if (tg_op = 'INSERT' and new.status = 'active') or
       (tg_op = 'UPDATE' and old.status <> 'active' and new.status = 'active') then
      v_title := 'Parking started';
      v_body := 'Your parking session has started.';

      perform public.create_notification(new.user_id, 'session', v_title, v_body, '/bookings');

    elsif tg_op = 'UPDATE' and old.status = 'active' and new.status in ('completed', 'auto_ended') then
      -- Check if overstay charges were incurred for this session
      select coalesce(sum(amount_paise), 0) into v_overstay_paise
      from public.overstay_charges
      where session_id = new.id;

      if v_overstay_paise > 0 then
        v_overstay_text := ' Overstay charge: ₹' || trim(to_char(v_overstay_paise / 100.0, '999990.00')) || '.';
      end if;

      v_title := 'Parking ended';
      v_body := 'Your parking session has ended. Duration: ' || coalesce(new.duration_minutes::text, '0') || ' mins.' || v_overstay_text;

      perform public.create_notification(new.user_id, 'session', v_title, v_body, '/bookings');
    end if;

  exception
    when others then
      null;
  end;

  return new;
end;
$$;

drop trigger if exists trg_parking_sessions_notify on public.parking_sessions;
create trigger trg_parking_sessions_notify
  after insert or update of status on public.parking_sessions
  for each row execute function public.trg_parking_sessions_notify_state_change();


-- 4d. Overstay Charges Trigger
create or replace function public.trg_overstay_charges_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_title text;
  v_body text;
begin
  begin
    select user_id into v_user_id
    from public.parking_sessions
    where id = new.session_id;

    if v_user_id is not null then
      v_title := 'Overstay charge applied';
      v_body := 'An overstay charge of ₹' || trim(to_char(new.amount_paise / 100.0, '999990.00')) ||
                ' was applied for ' || coalesce(new.overstay_minutes::text, '0') || ' minutes.';

      perform public.create_notification(v_user_id, 'session', v_title, v_body, '/bookings');
    end if;

  exception
    when others then
      null;
  end;

  return new;
end;
$$;

drop trigger if exists trg_overstay_charges_notify on public.overstay_charges;
create trigger trg_overstay_charges_notify
  after insert on public.overstay_charges
  for each row execute function public.trg_overstay_charges_notify();


-- ── 5. REALTIME PUBLICATION VERIFICATION ─────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;


-- ── 6. ENSURE EXACTLY ONE DEFAULT VEHICLE PER USER ───────────────────────────
-- Deduplicate any existing duplicate defaults per user
with ranked_defaults as (
  select id, row_number() over (partition by user_id order by updated_at desc, created_at desc) as rn
  from public.vehicles
  where is_default = true and archived_at is null
)
update public.vehicles
set is_default = false
where id in (select id from ranked_defaults where rn > 1);

-- Trigger to clear other defaults when a vehicle is set to default
create or replace function public.ensure_single_default_vehicle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_default = true and new.archived_at is null then
    update public.vehicles
    set is_default = false
    where user_id = new.user_id
      and id <> new.id
      and is_default = true
      and archived_at is null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_vehicles_ensure_single_default on public.vehicles;
create trigger trg_vehicles_ensure_single_default
  before insert or update of is_default, archived_at on public.vehicles
  for each row execute function public.ensure_single_default_vehicle();

notify pgrst, 'reload schema';
