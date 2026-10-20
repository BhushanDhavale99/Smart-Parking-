-- ============================================================================
-- Migration: 20261020173000_realtime.sql
-- Description: Realtime notifications and broadcast synchronization.
--              1. Creates public.availability_ping table for minimal, privacy-safe
--                 availability signals (no user/vehicle info broadcast).
--              2. Configures RLS: authenticated select only, no client writes.
--              3. Exception-safe triggers on public.bookings and public.parking_sessions
--                 that bump availability_ping on state transitions.
--              4. Enrolls availability_ping, bookings, parking_sessions, and
--                 notifications in the supabase_realtime publication.
-- ============================================================================

-- ── 1. AVAILABILITY PING TABLE ────────────────────────────────────────────────
-- Holds a single monotonic counter & timestamp. When any bay status or booking
-- changes, this row is updated. Realtime subscribers receive postgres_changes
-- on this table as a minimal availability cache-invalidation signal with NO personal data.
create table if not exists public.availability_ping (
  id integer primary key default 1 check (id = 1),
  ping_count bigint not null default 0,
  slot_id uuid references public.parking_slots(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Seed singleton row
insert into public.availability_ping (id, ping_count, slot_id, updated_at)
values (1, 0, null, now())
on conflict (id) do nothing;

comment on table public.availability_ping is
  'Minimal singleton table updated by database triggers to broadcast privacy-safe availability invalidations via Supabase Realtime.';

-- ── 2. RLS FOR AVAILABILITY PING ──────────────────────────────────────────────
alter table public.availability_ping enable row level security;

-- Client roles may only read; all mutations occur via security-definer triggers
revoke all on public.availability_ping from anon;
revoke insert, update, delete on public.availability_ping from authenticated;
grant select on public.availability_ping to authenticated;

drop policy if exists "availability_ping_authenticated_select" on public.availability_ping;
create policy "availability_ping_authenticated_select"
  on public.availability_ping
  for select
  to authenticated
  using (true);

-- ── 3. EXCEPTION-SAFE TRIGGER FUNCTION ────────────────────────────────────────
-- Updates the singleton availability_ping row.
-- CRITICAL SECURITY RULE: Enclosed in an EXCEPTION block so a failure in the
-- realtime signal can NEVER abort or roll back a booking or payment transaction.
create or replace function public.notify_availability_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot_id uuid;
begin
  if tg_table_name = 'bookings' then
    v_slot_id := new.slot_id;
  elsif tg_table_name = 'parking_sessions' then
    select slot_id into v_slot_id
    from public.bookings
    where id = new.booking_id;
  end if;

  insert into public.availability_ping (id, ping_count, slot_id, updated_at)
  values (1, 1, v_slot_id, now())
  on conflict (id) do update
  set ping_count = public.availability_ping.ping_count + 1,
      slot_id = excluded.slot_id,
      updated_at = excluded.updated_at;

  return coalesce(new, old);
exception
  when others then
    -- Catch and ignore: realtime notification failure must not block business operations
    return coalesce(new, old);
end;
$$;

comment on function public.notify_availability_change() is
  'Exception-safe trigger updating availability_ping without exposing user data or aborting parent transactions.';

-- ── 4. TRIGGERS ON BOOKINGS & PARKING_SESSIONS ───────────────────────────────
drop trigger if exists trg_bookings_availability_ping on public.bookings;
create trigger trg_bookings_availability_ping
  after insert or update of status, payment_status, start_at, end_at, slot_id
  on public.bookings
  for each row
  execute function public.notify_availability_change();

drop trigger if exists trg_sessions_availability_ping on public.parking_sessions;
create trigger trg_sessions_availability_ping
  after insert or update of status, ended_at
  on public.parking_sessions
  for each row
  execute function public.notify_availability_change();

-- ── 5. REPLICA IDENTITY & SUPABASE_REALTIME PUBLICATION ─────────────────────
-- Ensure postgres_changes payloads deliver necessary row attributes
alter table public.availability_ping replica identity full;
alter table public.bookings replica identity full;
alter table public.parking_sessions replica identity full;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'notifications'
  ) then
    alter table public.notifications replica identity full;
  end if;
end;
$$;

-- Safely add tables to supabase_realtime publication
do $$
begin
  -- 1. availability_ping
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'availability_ping'
  ) then
    alter publication supabase_realtime add table public.availability_ping;
  end if;

  -- 2. bookings (RLS ensures members only receive their own rows; admins receive all)
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bookings'
  ) then
    alter publication supabase_realtime add table public.bookings;
  end if;

  -- 3. parking_sessions (RLS ensures members only receive their own rows; admins receive all)
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'parking_sessions'
  ) then
    alter publication supabase_realtime add table public.parking_sessions;
  end if;

  -- 4. notifications (if table exists)
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'notifications'
  ) and not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;
