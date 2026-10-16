-- ============================================================
-- Migration: Member Vehicles with RLS, integrity triggers & RPC
-- Run this once in the Supabase SQL Editor.
-- ============================================================

-- ── 1. VEHICLES TABLE ────────────────────────────────────────
-- Represents member-owned vehicles.
-- Enforces:
--   - Plate normalization (alphanumeric 6-12 chars)
--   - Specific vehicle types ('car', 'suv', 'bike', 'ev')
--   - EV connector types (only when is_ev is true)
--   - Cascade deletion when an auth user is deleted
create table public.vehicles (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade default auth.uid(),
  plate_number    text not null check (plate_number ~ '^[A-Z0-9]{6,12}$'),
  vehicle_type    text not null check (vehicle_type in ('car', 'suv', 'bike', 'ev')),
  make            text check (make is null or length(trim(make)) between 1 and 50),
  model           text check (model is null or length(trim(model)) between 1 and 50),
  color           text check (color is null or length(trim(color)) between 1 and 30),
  is_ev           boolean not null default false,
  connector_type  text check (
                    (is_ev = false and connector_type is null) or
                    (is_ev = true and connector_type in ('CCS2', 'Type2', 'CHAdeMO', 'Bharat_AC001', 'Bharat_DC001'))
                  ),
  is_default      boolean not null default false,
  archived_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint vehicles_ev_type_check check (
    (vehicle_type = 'ev' and is_ev = true) or
    (vehicle_type in ('car', 'suv', 'bike'))
  )
);

comment on table public.vehicles is
  'Member registered vehicles for bay matching and automated entry.';

-- ── 2. INDEXES & CONSTRAINTS ──────────────────────────────────
-- Primary user lookup index
create index idx_vehicles_user_id on public.vehicles (user_id);

-- One active registration per plate per user (archived vehicles don't conflict)
create unique index idx_vehicles_user_plate_active
  on public.vehicles (user_id, plate_number)
  where archived_at is null;

-- Only one default vehicle per user among active vehicles
create unique index idx_vehicles_user_single_default
  on public.vehicles (user_id)
  where is_default = true and archived_at is null;

-- ── 3. TRIGGERS: PLATE NORMALIZATION, LIMITS & SECURITY ───────

-- A. Normalize plate number (strip non-alphanumeric and uppercase)
create or replace function public.normalize_vehicle_plate()
returns trigger
language plpgsql
as $$
begin
  if new.plate_number is not null then
    new.plate_number := upper(regexp_replace(new.plate_number, '[^a-zA-Z0-9]', '', 'g'));
  end if;
  return new;
end;
$$;

create trigger vehicles_normalize_plate
  before insert or update on public.vehicles
  for each row execute function public.normalize_vehicle_plate();

-- B. Maximum 5 active vehicles per user
create or replace function public.check_vehicle_limit()
returns trigger
language plpgsql
as $$
begin
  if new.archived_at is null and (tg_op = 'INSERT' or old.archived_at is not null) then
    if (
      select count(*)
      from public.vehicles
      where user_id = new.user_id
        and archived_at is null
        and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) >= 5 then
      raise exception 'Active vehicle limit reached (maximum 5 vehicles)' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger vehicles_check_limit
  before insert or update on public.vehicles
  for each row execute function public.check_vehicle_limit();

-- C. Prevent changing user_id (vehicle owner cannot be reassigned)
create or replace function public.prevent_vehicle_user_id_change()
returns trigger
language plpgsql
as $$
begin
  if old.user_id <> new.user_id then
    raise exception 'Changing vehicle owner (user_id) is forbidden' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger vehicles_prevent_user_id_change
  before update on public.vehicles
  for each row execute function public.prevent_vehicle_user_id_change();

-- D. Keep updated_at current
create trigger vehicles_set_updated_at
  before update on public.vehicles
  for each row execute function public.set_updated_at();

-- ── 4. ATOMIC DEFAULT VEHICLE SWITCHER (RPC) ──────────────────
-- Switches a user's active default vehicle atomically under SECURITY INVOKER
create or replace function public.set_default_vehicle(p_vehicle_id uuid)
returns public.vehicles
language plpgsql
security invoker
as $$
declare
  v_user_id uuid := auth.uid();
  v_vehicle public.vehicles;
begin
  if v_user_id is null then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  -- Verify vehicle exists, belongs to caller, and is active
  select * into v_vehicle
  from public.vehicles
  where id = p_vehicle_id and user_id = v_user_id and archived_at is null;

  if not found then
    raise exception 'Vehicle not found or already archived' using errcode = 'P0002';
  end if;

  -- Clear default flag on all other active vehicles for this user
  update public.vehicles
  set is_default = false
  where user_id = v_user_id and id <> p_vehicle_id and is_default = true and archived_at is null;

  -- Set default on target vehicle
  update public.vehicles
  set is_default = true, updated_at = now()
  where id = p_vehicle_id and user_id = v_user_id
  returning * into v_vehicle;

  return v_vehicle;
end;
$$;

-- ── 5. ROW LEVEL SECURITY (RLS) ───────────────────────────────
alter table public.vehicles enable row level security;

-- Revoke all privileges from anon
revoke all on public.vehicles from anon;
grant select, insert, update, delete on public.vehicles to authenticated;

revoke execute on function public.set_default_vehicle(uuid) from public, anon;
grant execute on function public.set_default_vehicle(uuid) to authenticated;

-- Members select their own vehicles; admins select all vehicles
create policy "vehicles_select_policy"
  on public.vehicles
  for select
  to authenticated
  using (
    auth.uid() = user_id or public.is_admin()
  );

-- Members insert vehicles only for their own user_id
create policy "vehicles_insert_policy"
  on public.vehicles
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
  );

-- Members update only their own vehicles
create policy "vehicles_update_policy"
  on public.vehicles
  for update
  to authenticated
  using (
    auth.uid() = user_id
  )
  with check (
    auth.uid() = user_id
  );

-- Members delete only their own vehicles
create policy "vehicles_delete_policy"
  on public.vehicles
  for delete
  to authenticated
  using (
    auth.uid() = user_id
  );
