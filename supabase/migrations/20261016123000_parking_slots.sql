-- ============================================================
-- Migration: Parking levels and slots with RLS & integrity rules
-- Run this once in the Supabase SQL Editor.
-- ============================================================

-- ── 1. PARKING_LEVELS TABLE ──────────────────────────────────
-- Fixed facility structure: B2, B1, G1, L1, L2.
-- Heavy vehicles are allowed only on G1, B1, and B2.
create table public.parking_levels (
  code          text primary key check (code in ('B2', 'B1', 'G1', 'L1', 'L2')),
  name          text not null,
  sort_order    int not null,
  allows_heavy  boolean not null default false
);

comment on table public.parking_levels is
  'Facility level definitions and vertical clearance/weight rules.';

-- ── 2. PARKING_SLOTS TABLE ───────────────────────────────────
-- Represents physical parking bays.
-- Fixed facts: code, level_code, zone, bay_number, slot_type, has_ev_charger.
-- State: admin_status ('active', 'maintenance', 'blocked') controlled by admins.
-- Slot occupancy is NOT stored here; time-based availability comes later from bookings.
-- Pricing note: Default standard is 5000 paise (₹50), EV is 7000 paise (₹70). Dynamic pricing rules will take over in a later feature.
create table public.parking_slots (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique check (code ~ '^[A-Z0-9]{1,3}-[0-9]{2,3}$'),
  level_code        text not null references public.parking_levels (code),
  zone              text not null check (zone in ('A', 'B', 'EV')),
  bay_number        int not null,
  slot_type         text not null check (slot_type in ('standard', 'ev', 'accessible')),
  has_ev_charger    boolean not null default false check (
                      (slot_type = 'ev' and has_ev_charger = true) or
                      (slot_type <> 'ev' and has_ev_charger = false)
                    ),
  hourly_rate_paise int not null check (hourly_rate_paise >= 0),
  admin_status      text not null default 'active' check (admin_status in ('active', 'maintenance', 'blocked')),
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint parking_slots_level_bay_key unique (level_code, bay_number)
);

comment on table public.parking_slots is
  'Physical parking bays and their administrative state. Occupancy is computed from bookings, not stored on slots.';

-- Performance Indexes
create index idx_parking_slots_level_zone on public.parking_slots (level_code, zone);
create index idx_parking_slots_admin_status on public.parking_slots (admin_status);

-- ── 3. TRIGGERS: UPDATED_AT & DELETE PREVENTION ──────────────
-- Keep updated_at current on row update
create trigger parking_slots_set_updated_at
  before update on public.parking_slots
  for each row execute function public.set_updated_at();

-- Prevent hard-deleting parking slots so future bookings and auditing records never lose reference.
create or replace function public.prevent_slot_deletion()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  -- TODO: Admins may delete only if the slot has never been used in any booking/session.
  -- For now, hard deletes are blocked entirely. Set admin_status to 'maintenance' or 'blocked' instead.
  raise exception 'Hard-deleting parking slots is forbidden. Set admin_status to maintenance or blocked instead.'
    using errcode = 'restrict_violation';
end;
$$;

create trigger parking_slots_prevent_delete
  before delete on public.parking_slots
  for each row execute function public.prevent_slot_deletion();

-- ── 4. ROW LEVEL SECURITY (RLS) ──────────────────────────────
alter table public.parking_levels enable row level security;
alter table public.parking_slots enable row level security;

-- SELECT policies: Authenticated users (members, staff, admins) can view all levels and slots
create policy "parking_levels: authenticated users can read all"
  on public.parking_levels
  for select
  to authenticated
  using (true);

create policy "parking_slots: authenticated users can read all"
  on public.parking_slots
  for select
  to authenticated
  using (true);

-- INSERT & UPDATE policies for parking_slots: Only admins can insert or update slots
create policy "parking_slots: admin insert"
  on public.parking_slots
  for insert
  to authenticated
  with check (public.is_admin());

create policy "parking_slots: admin update"
  on public.parking_slots
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- UPDATE policy for parking_levels: Only admins can update allows_heavy (level structure is otherwise fixed)
create policy "parking_levels: admin update allows_heavy"
  on public.parking_levels
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- No DELETE policy is defined on either table (parking_levels is read-only, and parking_slots trigger rejects deletes).

-- REVOKE all privileges from anon role on both tables
revoke all on table public.parking_levels from anon;
revoke all on table public.parking_slots from anon;
