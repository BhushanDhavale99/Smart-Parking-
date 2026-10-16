-- ============================================================================
-- Migration: Pricing Settings, Time-Based Availability & Bookings
-- Run this once in the Supabase SQL Editor.
-- ============================================================================

-- ── 1. EXTENSIONS ────────────────────────────────────────────
-- btree_gist allows combining scalar equality (= on slot_id) with range overlap (&& on during)
create extension if not exists btree_gist with schema extensions;
set search_path to public, extensions;

-- ── 2. PRICING_SETTINGS TABLE ─────────────────────────────────
-- Singleton configuration table for facility pricing, GST, and cancellation rules
create table if not exists public.pricing_settings (
  id                      boolean primary key default true check (id),
  gst_bps                 int not null default 1800 check (gst_bps >= 0),
  hold_minutes            int not null default 10 check (hold_minutes between 1 and 60),
  min_hours               int not null default 1 check (min_hours >= 1),
  max_hours               int not null default 24 check (max_hours >= min_hours),
  max_advance_days        int not null default 30 check (max_advance_days >= 1),
  refund_full_hours       int not null default 2 check (refund_full_hours >= 0),
  refund_partial_minutes  int not null default 30 check (refund_partial_minutes >= 0),
  partial_refund_bps      int not null default 5000 check (partial_refund_bps between 0 and 10000),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

comment on table public.pricing_settings is
  'Singleton operational pricing and reservation policy settings.';

-- Seed the single row (idempotent)
insert into public.pricing_settings (id)
values (true)
on conflict (id) do nothing;

-- ── 3. BOOKINGS TABLE ────────────────────────────────────────
-- Core reservation record storing financial snapshots, immutable dates, and status
create table if not exists public.bookings (
  id                    uuid primary key default gen_random_uuid(),
  reference             text not null unique check (reference ~ '^SP-[0-9]{8}-[A-Z0-9]{4}$'),
  user_id               uuid not null references public.profiles(id) on delete restrict,
  slot_id               uuid not null references public.parking_slots(id) on delete restrict,
  vehicle_id            uuid not null references public.vehicles(id) on delete restrict,
  plate_snapshot        text not null,
  vehicle_type_snapshot text not null,
  start_at              timestamptz not null,
  end_at                timestamptz not null check (end_at > start_at),
  during                tstzrange generated always as (tstzrange(start_at, end_at, '[)')) stored,
  hours                 int not null check (hours >= 1),
  hourly_rate_paise     int not null check (hourly_rate_paise >= 0),
  base_paise            int not null check (base_paise >= 0),
  gst_paise             int not null check (gst_paise >= 0),
  total_paise           int not null check (total_paise >= 0),
  status                text not null default 'reserved' check (
                          status in ('reserved', 'confirmed', 'active', 'completed', 'cancelled', 'no_show', 'expired')
                        ),
  payment_status        text not null default 'pending' check (
                          payment_status in ('pending', 'paid', 'failed', 'refunded', 'partially_refunded')
                        ),
  hold_expires_at       timestamptz,
  cancelled_at          timestamptz,
  cancellation_reason   text,
  refund_paise          int not null default 0 check (refund_paise >= 0),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  -- Database-level double-booking protection:
  -- Only active reservation states participate in the exclusion check.
  constraint bookings_slot_during_overlap_excl
    exclude using gist (
      slot_id with =,
      during with &&
    ) where (status in ('reserved', 'confirmed', 'active'))
);

comment on table public.bookings is
  'Member parking reservations with exclusion-constraint double booking prevention and audit snapshots.';

-- Performance Indexes
create index if not exists idx_bookings_user_start on public.bookings (user_id, start_at desc);
create index if not exists idx_bookings_status on public.bookings (status);
create index if not exists idx_bookings_start_at on public.bookings (start_at);

-- ── 4. TRIGGERS: IMMUTABILITY & TIMESTAMPS ─────────────────────
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

drop trigger if exists bookings_protect_immutability on public.bookings;
create trigger bookings_protect_immutability
  before update on public.bookings
  for each row execute function public.protect_booking_immutability();

drop trigger if exists bookings_set_updated_at on public.bookings;
create trigger bookings_set_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

drop trigger if exists pricing_settings_set_updated_at on public.pricing_settings;
create trigger pricing_settings_set_updated_at
  before update on public.pricing_settings
  for each row execute function public.set_updated_at();

-- ── 5. SECURITY DEFINER STORED PROCEDURES ─────────────────────

-- A. Expire stale holds
create or replace function public.expire_stale_holds()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.bookings
  set status = 'expired',
      updated_at = pg_catalog.now()
  where status = 'reserved'
    and hold_expires_at is not null
    and hold_expires_at < pg_catalog.now();
end;
$$;

-- B. Generate random unique reference: SP-YYYYMMDD-XXXX (IST date + 4 Base32 chars)
create or replace function public.generate_booking_reference()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_chars text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_ref text;
  v_date text;
  v_rand text;
  v_exists boolean;
  i int;
begin
  v_date := pg_catalog.to_char(pg_catalog.timezone('Asia/Kolkata', pg_catalog.now()), 'YYYYMMDD');
  for attempt in 1..10 loop
    v_rand := '';
    for i in 1..4 loop
      v_rand := v_rand || pg_catalog.substr(v_chars, pg_catalog.floor(pg_catalog.random() * pg_catalog.length(v_chars) + 1)::int, 1);
    end loop;
    v_ref := 'SP-' || v_date || '-' || v_rand;
    select exists(select 1 from public.bookings where reference = v_ref) into v_exists;
    if not v_exists then
      return v_ref;
    end if;
  end loop;
  raise exception 'Could not generate unique booking reference' using errcode = 'P0001';
end;
$$;

-- C. Quote booking: computes hours, base, GST, and total in integer paise
create or replace function public.quote_booking(
  p_slot_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
returns table (
  hours int,
  hourly_rate_paise int,
  base_paise int,
  gst_paise int,
  total_paise int
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slot record;
  v_settings record;
  v_duration_secs numeric;
  v_hours int;
  v_base int;
  v_gst int;
  v_total int;
begin
  if p_end <= p_start then
    raise exception 'End time must be after start time' using errcode = 'P0001';
  end if;

  select * into v_slot from public.parking_slots where id = p_slot_id;
  if not found then
    raise exception 'Slot not found' using errcode = 'P0002';
  end if;

  select * into v_settings from public.pricing_settings where id = true;

  v_duration_secs := extract(epoch from (p_end - p_start));
  v_hours := pg_catalog.ceil(v_duration_secs / 3600.0)::int;

  if v_hours < v_settings.min_hours or v_hours > v_settings.max_hours then
    raise exception 'Booking duration must be between % and % hours', v_settings.min_hours, v_settings.max_hours using errcode = 'P0001';
  end if;

  v_base := v_hours * v_slot.hourly_rate_paise;
  v_gst := pg_catalog.round((v_base::numeric * v_settings.gst_bps::numeric) / 10000.0)::int;
  v_total := v_base + v_gst;

  return query select v_hours, v_slot.hourly_rate_paise, v_base, v_gst, v_total;
end;
$$;

-- D. Slot availability for a given time window (active slots only, zero personal data)
create or replace function public.slot_availability(
  p_start timestamptz,
  p_end timestamptz,
  p_level text default null,
  p_zone text default null,
  p_slot_type text default null
)
returns table (
  slot_id uuid,
  is_available boolean
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.expire_stale_holds();

  return query
  select
    s.id as slot_id,
    not exists (
      select 1
      from public.bookings b
      where b.slot_id = s.id
        and b.status in ('reserved', 'confirmed', 'active')
        and b.during && pg_catalog.tstzrange(p_start, p_end, '[)')
    ) as is_available
  from public.parking_slots s
  where s.admin_status = 'active'
    and (p_level is null or p_level = 'All' or s.level_code = p_level)
    and (p_zone is null or p_zone = 'All' or s.zone = p_zone)
    and (p_slot_type is null or p_slot_type = 'All' or s.slot_type = p_slot_type);
end;
$$;

-- E. Create booking
create or replace function public.create_booking(
  p_slot_id uuid,
  p_vehicle_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_slot record;
  v_vehicle record;
  v_settings record;
  v_hours int;
  v_base int;
  v_gst int;
  v_total int;
  v_ref text;
  v_booking public.bookings;
  v_start_min int;
  v_start_sec int;
begin
  if v_user_id is null then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  perform public.expire_stale_holds();

  select * into v_settings from public.pricing_settings where id = true;

  -- 1. Validate start time
  if p_start < (pg_catalog.now() - interval '5 minutes') then
    raise exception 'Booking start time cannot be in the past' using errcode = 'P0001';
  end if;

  if p_start > (pg_catalog.now() + (v_settings.max_advance_days || ' days')::interval) then
    raise exception 'Booking cannot be made more than % days in advance', v_settings.max_advance_days using errcode = 'P0001';
  end if;

  -- 2. Validate 15-minute alignment (in IST)
  v_start_min := extract(minute from pg_catalog.timezone('Asia/Kolkata', p_start))::int;
  v_start_sec := extract(second from pg_catalog.timezone('Asia/Kolkata', p_start))::int;
  if (v_start_min % 15 <> 0) or (v_start_sec <> 0) then
    raise exception 'Booking start time must be aligned to a 15-minute mark' using errcode = 'P0001';
  end if;

  -- 3. Validate slot
  select * into v_slot from public.parking_slots where id = p_slot_id;
  if not found or v_slot.admin_status <> 'active' then
    raise exception 'Parking slot is not available for reservations' using errcode = 'P0001';
  end if;

  -- 4. Validate vehicle (must belong to caller and not be archived)
  select * into v_vehicle from public.vehicles where id = p_vehicle_id and user_id = v_user_id and archived_at is null;
  if not found then
    raise exception 'Selected vehicle not found or not active' using errcode = 'P0001';
  end if;

  -- 5. EV compatibility check
  if v_slot.slot_type = 'ev' and not (v_vehicle.is_ev or v_vehicle.vehicle_type = 'ev') then
    raise exception 'An electric vehicle is required for EV charging bays' using errcode = 'P0001';
  end if;

  -- 6. Compute price and duration
  v_hours := pg_catalog.ceil(extract(epoch from (p_end - p_start)) / 3600.0)::int;
  if v_hours < v_settings.min_hours or v_hours > v_settings.max_hours then
    raise exception 'Booking duration must be between % and % hours', v_settings.min_hours, v_settings.max_hours using errcode = 'P0001';
  end if;

  v_base := v_hours * v_slot.hourly_rate_paise;
  v_gst := pg_catalog.round((v_base::numeric * v_settings.gst_bps::numeric) / 10000.0)::int;
  v_total := v_base + v_gst;

  -- 7. Generate reference
  v_ref := public.generate_booking_reference();

  -- 8. Insert with exclusion-constraint protection
  begin
    insert into public.bookings (
      reference,
      user_id,
      slot_id,
      vehicle_id,
      plate_snapshot,
      vehicle_type_snapshot,
      start_at,
      end_at,
      hours,
      hourly_rate_paise,
      base_paise,
      gst_paise,
      total_paise,
      status,
      payment_status,
      hold_expires_at
    ) values (
      v_ref,
      v_user_id,
      p_slot_id,
      p_vehicle_id,
      v_vehicle.plate_number,
      v_vehicle.vehicle_type,
      p_start,
      p_end,
      v_hours,
      v_slot.hourly_rate_paise,
      v_base,
      v_gst,
      v_total,
      'reserved',
      'pending',
      pg_catalog.now() + (v_settings.hold_minutes || ' minutes')::interval
    )
    returning * into v_booking;
  exception
    when sqlstate '23P01' then
      raise exception 'This slot was just taken for that time' using errcode = 'P0003';
  end;

  return v_booking;
end;
$$;

-- F. Cancellation preview
create or replace function public.cancellation_preview(p_booking_id uuid)
returns table (
  booking_id uuid,
  total_paise int,
  refund_paise int,
  refund_percentage int,
  payment_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_booking record;
  v_settings record;
  v_hours_until_start numeric;
  v_mins_until_start numeric;
  v_refund int := 0;
  v_pct int := 0;
begin
  if v_user_id is null then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id;
  if not found then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;

  if v_booking.user_id <> v_user_id and not public.is_admin() then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  if v_booking.status not in ('reserved', 'confirmed') then
    raise exception 'Only reserved or confirmed bookings can be cancelled' using errcode = 'P0001';
  end if;

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
  else
    v_refund := 0;
    v_pct := 0;
  end if;

  return query select v_booking.id, v_booking.total_paise, v_refund, v_pct, v_booking.payment_status;
end;
$$;

-- G. Cancel booking
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
begin
  if v_user_id is null then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id;
  if not found then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;

  if v_booking.user_id <> v_user_id and not public.is_admin() then
    raise exception 'Access denied' using errcode = '42501';
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

-- H. dev_confirm_booking
-- TEMPORARY: replaced by real mock payment; DROP this function in the payments migration
create or replace function public.dev_confirm_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_booking public.bookings;
begin
  if v_user_id is null then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id and user_id = v_user_id;
  if not found then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;

  if v_booking.status <> 'reserved' then
    raise exception 'Only reserved bookings can be confirmed' using errcode = 'P0001';
  end if;

  if v_booking.hold_expires_at is not null and v_booking.hold_expires_at < pg_catalog.now() then
    raise exception 'Reservation hold has expired. Please select a space again.' using errcode = 'P0001';
  end if;

  update public.bookings
  set status = 'confirmed',
      payment_status = 'paid',
      updated_at = pg_catalog.now()
  where id = p_booking_id
  returning * into v_booking;

  return v_booking;
end;
$$;

-- ── 6. ROW LEVEL SECURITY (RLS) ───────────────────────────────
alter table public.pricing_settings enable row level security;
alter table public.bookings enable row level security;

-- Revoke all direct mutations from authenticated and anon
revoke all on public.pricing_settings from anon;
grant select on public.pricing_settings to authenticated;
grant update on public.pricing_settings to authenticated;

revoke all on public.bookings from anon, authenticated;
grant select on public.bookings to authenticated;

-- Policies for pricing_settings
drop policy if exists "pricing_settings_select_policy" on public.pricing_settings;
create policy "pricing_settings_select_policy"
  on public.pricing_settings
  for select
  to authenticated
  using (true);

drop policy if exists "pricing_settings_update_policy" on public.pricing_settings;
create policy "pricing_settings_update_policy"
  on public.pricing_settings
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Policies for bookings (SELECT ONLY — all writes go through Security Definer functions)
drop policy if exists "bookings_select_policy" on public.bookings;
create policy "bookings_select_policy"
  on public.bookings
  for select
  to authenticated
  using (
    auth.uid() = user_id or public.is_admin()
  );

-- Function permissions
revoke execute on function public.expire_stale_holds() from public, anon;
grant  execute on function public.expire_stale_holds() to authenticated;

revoke execute on function public.generate_booking_reference() from public, anon;
grant  execute on function public.generate_booking_reference() to authenticated;

revoke execute on function public.quote_booking(uuid, timestamptz, timestamptz) from public, anon;
grant  execute on function public.quote_booking(uuid, timestamptz, timestamptz) to authenticated;

revoke execute on function public.slot_availability(timestamptz, timestamptz, text, text, text) from public, anon;
grant  execute on function public.slot_availability(timestamptz, timestamptz, text, text, text) to authenticated;

revoke execute on function public.create_booking(uuid, uuid, timestamptz, timestamptz) from public, anon;
grant  execute on function public.create_booking(uuid, uuid, timestamptz, timestamptz) to authenticated;

revoke execute on function public.cancellation_preview(uuid) from public, anon;
grant  execute on function public.cancellation_preview(uuid) to authenticated;

revoke execute on function public.cancel_booking(uuid, text) from public, anon;
grant  execute on function public.cancel_booking(uuid, text) to authenticated;

revoke execute on function public.dev_confirm_booking(uuid) from public, anon;
grant  execute on function public.dev_confirm_booking(uuid) to authenticated;
