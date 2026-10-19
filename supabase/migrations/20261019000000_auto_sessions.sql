-- ============================================================================
-- Migration: 20261019000000_auto_sessions.sql
-- Description: Automatic parking sessions (no QR/gate), overstay charges,
--              safety auto-complete cap, and cancel-session cleanup.
-- ============================================================================

-- ── 0. CLEAN UP UNUSED LEGACY QR / GATE BARRIER TABLES ─────────────────────
-- In earlier prototypes, physical gate barrier and QR pass tables were created.
-- Since this system uses automatic timer-based parking (no QR / no gate barriers),
-- we cleanly remove these unused legacy tables and recreate parking_sessions cleanly.
drop table if exists public.scan_logs cascade;
drop table if exists public.parking_sessions cascade;
drop table if exists public.parking_passes cascade;

-- ── 1. PRICING_SETTINGS: add exit_grace_minutes ───────────────────────────
alter table public.pricing_settings
  add column if not exists exit_grace_minutes int not null default 15
    check (exit_grace_minutes >= 0);

comment on column public.pricing_settings.exit_grace_minutes is
  'Grace period in minutes after booked end_at before overstay charges begin.';

-- ── 2. PARKING_SESSIONS TABLE ──────────────────────────────────────────────
-- One row per confirmed booking. Created by DB trigger on payment confirmation.
-- "active" is derived on read from started_at/ended_at — no scheduled job needed.
create table if not exists public.parking_sessions (
  id              uuid primary key default gen_random_uuid(),
  booking_id      uuid not null unique references public.bookings(id) on delete restrict,
  user_id         uuid not null references auth.users(id) on delete restrict,
  started_at      timestamptz not null default now(),          -- equals booking.start_at
  booked_end_at   timestamptz not null default now(),          -- equals booking.end_at
  ended_at        timestamptz,                   -- null = still active
  ended_by_admin  boolean not null default false,
  duration_minutes int,                          -- set when ended
  status          text not null default 'active'
                  check (status in ('active', 'completed', 'auto_ended', 'cancelled')),
  auto_ended      boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Defensive schema repair in case public.parking_sessions pre-existed from an earlier prototype:
alter table public.parking_sessions
  add column if not exists booking_id      uuid references public.bookings(id) on delete restrict,
  add column if not exists user_id         uuid references auth.users(id) on delete restrict,
  add column if not exists started_at      timestamptz not null default now(),
  add column if not exists booked_end_at   timestamptz not null default now(),
  add column if not exists ended_at        timestamptz,
  add column if not exists ended_by_admin  boolean not null default false,
  add column if not exists duration_minutes int,
  add column if not exists status          text not null default 'active',
  add column if not exists auto_ended      boolean not null default false,
  add column if not exists created_at      timestamptz not null default now(),
  add column if not exists updated_at      timestamptz not null default now();

-- Backfill user_id on existing rows if any exist with booking_id:
update public.parking_sessions ps
set user_id = b.user_id
from public.bookings b
where ps.booking_id = b.id
  and ps.user_id is null;

-- Drop NOT NULL constraints from any legacy columns (e.g. pass_id, entry_gate) from earlier templates:
do $$
declare
  col text;
begin
  for col in (
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'parking_sessions'
      and is_nullable = 'NO'
      and column_name not in ('id', 'created_at', 'updated_at', 'started_at', 'booked_end_at', 'ended_by_admin', 'status', 'auto_ended')
  ) loop
    execute format('alter table public.parking_sessions alter column %I drop not null;', col);
  end loop;
end $$;

-- Ensure unique constraint on booking_id if not present:
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.parking_sessions'::regclass
      and contype = 'u'
      and conkey = array[
        (select attnum from pg_attribute where attrelid = 'public.parking_sessions'::regclass and attname = 'booking_id')
      ]
  ) then
    begin
      alter table public.parking_sessions add constraint parking_sessions_booking_id_key unique (booking_id);
    exception when others then
      null;
    end;
  end if;
end $$;

comment on table public.parking_sessions is
  'One parking session per confirmed booking. Active status derived on read from timestamps.';

create index if not exists idx_sessions_booking_id  on public.parking_sessions (booking_id);
create index if not exists idx_sessions_user_id     on public.parking_sessions (user_id);
create index if not exists idx_sessions_status      on public.parking_sessions (status);
create index if not exists idx_sessions_started_at  on public.parking_sessions (started_at desc);

-- updated_at trigger reuse
drop trigger if exists parking_sessions_set_updated_at on public.parking_sessions;
create trigger parking_sessions_set_updated_at
  before update on public.parking_sessions
  for each row execute function public.set_updated_at();

-- ── 3. OVERSTAY_CHARGES TABLE ──────────────────────────────────────────────
-- Separate from payments to avoid the idx_payments_booking_succeeded unique
-- partial index (one successful payment per booking_id). Overstay charges live
-- here and are marked paid via the mock provider at end_session time.
create table if not exists public.overstay_charges (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid not null references public.parking_sessions(id) on delete restrict,
  booking_id        uuid not null references public.bookings(id) on delete restrict,
  user_id           uuid not null references auth.users(id) on delete restrict,
  overstay_minutes  int not null default 0 check (overstay_minutes >= 0),
  base_paise        int not null default 0 check (base_paise >= 0),
  gst_paise         int not null default 0 check (gst_paise >= 0),
  total_paise       int not null default 0 check (total_paise >= 0),
  provider_ref      text,
  receipt_number    text unique,
  paid_at           timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

-- Defensive schema repair in case public.overstay_charges pre-existed:
alter table public.overstay_charges
  add column if not exists session_id        uuid references public.parking_sessions(id) on delete restrict,
  add column if not exists booking_id        uuid references public.bookings(id) on delete restrict,
  add column if not exists user_id           uuid references auth.users(id) on delete restrict,
  add column if not exists overstay_minutes  int not null default 0,
  add column if not exists base_paise        int not null default 0,
  add column if not exists gst_paise         int not null default 0,
  add column if not exists total_paise       int not null default 0,
  add column if not exists provider_ref      text,
  add column if not exists receipt_number    text,
  add column if not exists paid_at           timestamptz not null default now(),
  add column if not exists created_at        timestamptz not null default now();

-- Drop NOT NULL constraints from any legacy columns from earlier templates:
do $$
declare
  col text;
begin
  for col in (
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'overstay_charges'
      and is_nullable = 'NO'
      and column_name not in ('id', 'created_at', 'paid_at', 'overstay_minutes', 'base_paise', 'gst_paise', 'total_paise')
  ) loop
    execute format('alter table public.overstay_charges alter column %I drop not null;', col);
  end loop;
end $$;

comment on table public.overstay_charges is
  'Overstay charges recorded at end_session time, separate from the main payments ledger.';

create index if not exists idx_overstay_session_id  on public.overstay_charges (session_id);
create index if not exists idx_overstay_booking_id  on public.overstay_charges (booking_id);
create index if not exists idx_overstay_user_id     on public.overstay_charges (user_id);

-- ── 4. RLS ─────────────────────────────────────────────────────────────────
alter table public.parking_sessions enable row level security;
alter table public.overstay_charges  enable row level security;

-- No direct mutations from API roles; all writes through security-definer functions.
revoke all on public.parking_sessions from anon;
revoke insert, update, delete on public.parking_sessions from authenticated;
grant select on public.parking_sessions to authenticated;

revoke all on public.overstay_charges from anon;
revoke insert, update, delete on public.overstay_charges from authenticated;
grant select on public.overstay_charges to authenticated;

drop policy if exists "sessions_select_policy" on public.parking_sessions;
create policy "sessions_select_policy"
  on public.parking_sessions for select to authenticated
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "overstay_select_policy" on public.overstay_charges;
create policy "overstay_select_policy"
  on public.overstay_charges for select to authenticated
  using (auth.uid() = user_id or public.is_admin());

-- ── 5. TRIGGER: CREATE SESSION ON BOOKING CONFIRMATION ────────────────────
-- Fires AFTER UPDATE on bookings when new.status = 'confirmed' and
-- old.status = 'reserved'. This runs inside pay_for_booking's transaction.
create or replace function public.create_session_on_confirm()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Only react to reserved → confirmed transition
  if new.status = 'confirmed' and old.status = 'reserved' then
    -- Guard: only create if no session exists yet (idempotent)
    if not exists (
      select 1 from public.parking_sessions where booking_id = new.id
    ) then
      insert into public.parking_sessions (
        booking_id, user_id, started_at, booked_end_at, status
      ) values (
        new.id, new.user_id, new.start_at, new.end_at, 'active'
      );
    end if;
  end if;

  -- If booking is cancelled, cancel any pending (not-yet-started) session
  if new.status = 'cancelled' then
    update public.parking_sessions
    set status = 'cancelled',
        updated_at = pg_catalog.now()
    where booking_id = new.id
      and status = 'active'
      and ended_at is null
      and started_at > pg_catalog.now();  -- hasn't started yet
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_create_session on public.bookings;
create trigger bookings_create_session
  after update on public.bookings
  for each row execute function public.create_session_on_confirm();

-- ── 5.1 SEED SESSIONS FOR EXISTING BOOKINGS ──────────────────────────────
-- Backfill parking_sessions for any existing confirmed, active, or completed
-- bookings that were created before this migration was run.
insert into public.parking_sessions (
  booking_id, user_id, started_at, booked_end_at, ended_at, duration_minutes, status
)
select
  b.id,
  b.user_id,
  b.start_at,
  b.end_at,
  case when b.status = 'completed' then b.end_at else null end,
  case when b.status = 'completed' then greatest(0, pg_catalog.ceil(extract(epoch from (b.end_at - b.start_at)) / 60.0)::int) else null end,
  case
    when b.status = 'completed' then 'completed'
    when b.status = 'cancelled' then 'cancelled'
    else 'active'
  end
from public.bookings b
where b.status in ('confirmed', 'active', 'completed')
  and not exists (
    select 1 from public.parking_sessions ps where ps.booking_id = b.id
  );

-- ── 6. HELPER: GENERATE OVERSTAY RECEIPT NUMBER ───────────────────────────
create or replace function public.generate_overstay_receipt_number()
returns text
language plpgsql
volatile
security definer
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
  v_date := pg_catalog.to_char(pg_catalog.timezone('Asia/Kolkata', pg_catalog.now()), 'YYYYMMDD');
  loop
    v_attempts := v_attempts + 1;
    if v_attempts > 100 then
      raise exception 'Failed to generate unique overstay receipt' using errcode = 'P0001';
    end if;
    v_random := '';
    for v_i in 1..4 loop
      v_random := v_random || pg_catalog.substr(v_chars,
        pg_catalog.floor(pg_catalog.random() * pg_catalog.length(v_chars) + 1)::int, 1);
    end loop;
    v_candidate := 'OV-' || v_date || '-' || v_random;
    if not exists (select 1 from public.overstay_charges where receipt_number = v_candidate) then
      return v_candidate;
    end if;
  end loop;
end;
$$;

-- ── 7. FUNCTION: get_active_session ───────────────────────────────────────
-- Returns session data with computed time fields. Auto-completes sessions that
-- are more than 12 hours past their booked end (safety cap). No pg_cron needed.
create or replace function public.get_active_session(p_booking_id uuid default null)
returns table (
  session_id         uuid,
  booking_id         uuid,
  user_id            uuid,
  started_at         timestamptz,
  booked_end_at      timestamptz,
  ended_at           timestamptz,
  status             text,
  auto_ended         boolean,
  ended_by_admin     boolean,
  duration_minutes   int,
  is_active          boolean,
  elapsed_seconds    bigint,
  seconds_remaining  bigint,   -- negative when past booked_end; 0 when ended
  overstay_seconds   bigint,   -- 0 when within grace or ended on time
  overstay_paise_so_far int    -- real-time running estimate (no GST, just base)
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id   uuid := auth.uid();
  v_sess        public.parking_sessions;
  v_settings    public.pricing_settings;
  v_now         timestamptz;
  v_cap_secs    constant bigint := 12 * 3600; -- 12 hours safety cap
  v_is_active   boolean;
  v_elapsed_sec bigint;
  v_secs_rem    bigint;
  v_over_secs   bigint;
  v_over_base   int;
begin
  if v_caller_id is null then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  if p_booking_id is not null then
    select * into v_sess
    from public.parking_sessions
    where booking_id = p_booking_id;
  else
    select * into v_sess
    from public.parking_sessions
    where user_id = v_caller_id
      and status = 'active'
      and ended_at is null
    order by started_at desc
    limit 1;
  end if;

  if not found then
    return;
  end if;

  p_booking_id := v_sess.booking_id;

  -- Security: member may only read their own session
  if v_sess.user_id <> v_caller_id and not public.is_admin() then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  select * into v_settings from public.pricing_settings where id = true;
  v_now := pg_catalog.now();

  -- ── Safety auto-complete cap ──────────────────────────────────────────
  -- A session never ended that is >12h past booked_end_at is auto-completed.
  if v_sess.ended_at is null
     and v_sess.status = 'active'
     and v_now > (v_sess.booked_end_at + (v_cap_secs || ' seconds')::interval)
  then
    declare
      v_capped_minutes int;
      v_overstay_min   int;
      v_base           int := 0;
      v_gst            int := 0;
      v_total          int := 0;
      v_rcpt           text;
      v_hourly_rate    int := 0;
    begin
      v_capped_minutes := (v_cap_secs / 60)::int;
      v_overstay_min   := greatest(0, v_capped_minutes - v_settings.exit_grace_minutes);

      select hourly_rate_paise into v_hourly_rate
      from public.bookings where id = p_booking_id;

      if v_overstay_min > 0 then
        v_base  := pg_catalog.ceil(v_overstay_min::numeric * v_hourly_rate / 60.0)::int;
        v_gst   := pg_catalog.round((v_base::numeric * v_settings.gst_bps::numeric) / 10000.0)::int;
        v_total := v_base + v_gst;
      end if;

      -- Write session completion
      update public.parking_sessions
      set status           = 'auto_ended',
          auto_ended       = true,
          ended_at         = v_sess.booked_end_at + (v_cap_secs || ' seconds')::interval,
          duration_minutes = pg_catalog.ceil(
            extract(epoch from ((v_sess.booked_end_at + (v_cap_secs || ' seconds')::interval) - v_sess.started_at)) / 60.0
          )::int,
          updated_at       = v_now
      where id = v_sess.id;

      -- Re-read after update
      select * into v_sess from public.parking_sessions where id = v_sess.id;

      -- Record overstay charge if any (cap > grace)
      if v_overstay_min > 0 then
        v_rcpt := public.generate_overstay_receipt_number();
        insert into public.overstay_charges (
          session_id, booking_id, user_id,
          overstay_minutes, base_paise, gst_paise, total_paise,
          provider_ref, receipt_number, paid_at
        ) values (
          v_sess.id, p_booking_id, v_sess.user_id,
          v_overstay_min,
          v_base, v_gst, v_total,
          'MOCK-AUTO-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
          v_rcpt, v_now
        );
      end if;

      -- Mark booking completed
      update public.bookings
      set status = 'completed', updated_at = v_now
      where id = p_booking_id;
    end;
  end if;

  -- ── Compute derived fields ────────────────────────────────────────────
  v_now := pg_catalog.now();

  if v_sess.ended_at is not null then
    v_is_active   := false;
    v_elapsed_sec := extract(epoch from (v_sess.ended_at - v_sess.started_at))::bigint;
    v_secs_rem    := 0;
    v_over_secs   := 0;
    v_over_base   := 0;
  elsif v_now < v_sess.started_at then
    -- Scheduled: booking start_at is still in future
    v_is_active   := false;
    v_elapsed_sec := 0;
    v_secs_rem    := extract(epoch from (v_sess.booked_end_at - v_now))::bigint;
    v_over_secs   := 0;
    v_over_base   := 0;
  else
    -- Active session: started_at <= now, ended_at is null
    v_is_active   := true;
    v_elapsed_sec := extract(epoch from (v_now - v_sess.started_at))::bigint;
    v_secs_rem    := extract(epoch from (v_sess.booked_end_at - v_now))::bigint;

    -- Keep booking status consistent: 'active' while parked
    update public.bookings
    set status = 'active', updated_at = v_now
    where id = p_booking_id and status = 'confirmed';

    -- Overstay only begins after grace period
    declare
      v_grace_secs  bigint := v_settings.exit_grace_minutes * 60;
      v_past_end    bigint;
      v_hourly_rate int := 0;
    begin
      v_past_end  := greatest(0, extract(epoch from (v_now - v_sess.booked_end_at))::bigint);
      v_over_secs := greatest(0, v_past_end - v_grace_secs);

      select hourly_rate_paise into v_hourly_rate
      from public.bookings where id = p_booking_id;

      v_over_base := pg_catalog.ceil(
        v_over_secs::numeric * v_hourly_rate / 3600.0
      )::int;
    end;
  end if;

  return query select
    v_sess.id,
    v_sess.booking_id,
    v_sess.user_id,
    v_sess.started_at,
    v_sess.booked_end_at,
    v_sess.ended_at,
    v_sess.status,
    v_sess.auto_ended,
    v_sess.ended_by_admin,
    v_sess.duration_minutes,
    v_is_active,
    v_elapsed_sec,
    v_secs_rem,
    v_over_secs,
    v_over_base;
end;
$$;

-- ── 8. FUNCTION: end_session ──────────────────────────────────────────────
-- Owner or admin only. Records end time, computes overstay charge if applicable,
-- inserts overstay_charges row, and transitions booking to 'completed'.
create or replace function public.end_session(p_session_id uuid)
returns table (
  session_id        uuid,
  booking_id        uuid,
  ended_at          timestamptz,
  duration_minutes  int,
  overstay_minutes  int,
  overstay_total_paise int
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id   uuid := auth.uid();
  v_sess        public.parking_sessions;
  v_booking     public.bookings;
  v_settings    public.pricing_settings;
  v_now         timestamptz := pg_catalog.now();
  v_dur_min     int;
  v_over_min    int;
  v_base        int;
  v_gst         int;
  v_total       int;
  v_rcpt        text;
  v_grace_min   int;
begin
  if v_caller_id is null then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  -- Lock the session row (match session ID or booking ID)
  select * into v_sess
  from public.parking_sessions
  where id = p_session_id or booking_id = p_session_id
  for update;

  if not found then
    raise exception 'Session not found' using errcode = 'P0002';
  end if;

  -- Security: owner or admin
  if v_sess.user_id <> v_caller_id and not public.is_admin() then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  -- Idempotency: already ended
  if v_sess.ended_at is not null then
    raise exception 'Session has already been ended' using errcode = 'P0001';
  end if;

  if v_sess.status not in ('active') then
    raise exception 'Session cannot be ended (status: %)', v_sess.status using errcode = 'P0001';
  end if;

  select * into v_booking
  from public.bookings
  where id = v_sess.booking_id
  for update;

  select * into v_settings from public.pricing_settings where id = true;
  v_grace_min := v_settings.exit_grace_minutes;

  -- Duration from booked start_at to now (in minutes)
  v_dur_min := greatest(0,
    pg_catalog.ceil(extract(epoch from (v_now - v_sess.started_at)) / 60.0)::int
  );

  -- Overstay = minutes past (booked_end + grace), floored at 0
  v_over_min := greatest(0,
    pg_catalog.ceil(
      extract(epoch from (v_now - v_sess.booked_end_at)) / 60.0
    )::int - v_grace_min
  );

  -- Write session end
  update public.parking_sessions
  set ended_at         = v_now,
      duration_minutes = v_dur_min,
      status           = 'completed',
      ended_by_admin   = (v_sess.user_id <> v_caller_id),
      updated_at       = v_now
  where id = v_sess.id
  returning * into v_sess;

  -- ── Overstay charge ───────────────────────────────────────────────────
  v_base  := 0;
  v_gst   := 0;
  v_total := 0;

  if v_over_min > 0 then
    v_base  := pg_catalog.ceil(
                 v_over_min::numeric * v_booking.hourly_rate_paise / 60.0
               )::int;
    v_gst   := pg_catalog.round(
                 (v_base::numeric * v_settings.gst_bps::numeric) / 10000.0
               )::int;
    v_total := v_base + v_gst;

    v_rcpt := public.generate_overstay_receipt_number();

    insert into public.overstay_charges (
      session_id, booking_id, user_id,
      overstay_minutes, base_paise, gst_paise, total_paise,
      provider_ref, receipt_number, paid_at
    ) values (
      v_sess.id, v_booking.id, v_sess.user_id,
      v_over_min, v_base, v_gst, v_total,
      'MOCK-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),
      v_rcpt, v_now
    );
  end if;

  -- Transition booking to completed
  update public.bookings
  set status     = 'completed',
      updated_at = v_now
  where id = v_booking.id;

  return query select
    v_sess.id,
    v_sess.booking_id,
    v_sess.ended_at,
    v_sess.duration_minutes,
    v_over_min,
    v_total;
end;
$$;

-- ── 9. FUNCTION: list_my_sessions ─────────────────────────────────────────
create or replace function public.list_my_sessions(
  p_status    text default null,   -- 'active'|'completed'|'auto_ended'|null=all
  p_page      int  default 1,
  p_page_size int  default 10
)
returns table (
  session_id        uuid,
  booking_id        uuid,
  started_at        timestamptz,
  booked_end_at     timestamptz,
  ended_at          timestamptz,
  status            text,
  auto_ended        boolean,
  duration_minutes  int,
  booking_reference text,
  slot_code         text,
  level_code        text,
  plate_snapshot    text,
  overstay_total_paise int,
  total_count       bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id uuid := auth.uid();
  v_offset    int  := greatest(0, (p_page - 1)) * least(p_page_size, 50);
  v_limit     int  := least(coalesce(p_page_size, 10), 50);
begin
  if v_caller_id is null then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  return query
  select
    ps.id,
    ps.booking_id,
    ps.started_at,
    ps.booked_end_at,
    ps.ended_at,
    ps.status,
    ps.auto_ended,
    ps.duration_minutes,
    b.reference,
    sl.code,
    sl.level_code,
    b.plate_snapshot,
    coalesce((
      select sum(oc.total_paise)
      from public.overstay_charges oc
      where oc.session_id = ps.id
    ), 0)::int,
    count(*) over() as total_count
  from public.parking_sessions ps
  join public.bookings       b  on b.id  = ps.booking_id
  join public.parking_slots  sl on sl.id = b.slot_id
  where ps.user_id = v_caller_id
    and (p_status is null or ps.status = p_status)
  order by ps.started_at desc
  limit v_limit offset v_offset;
end;
$$;

-- ── 10. FUNCTION: get_session ─────────────────────────────────────────────
create or replace function public.get_session(p_session_id uuid)
returns table (
  session_id        uuid,
  booking_id        uuid,
  user_id           uuid,
  started_at        timestamptz,
  booked_end_at     timestamptz,
  ended_at          timestamptz,
  status            text,
  auto_ended        boolean,
  ended_by_admin    boolean,
  duration_minutes  int,
  booking_reference text,
  slot_code         text,
  level_code        text,
  plate_snapshot    text,
  overstay_total_paise int
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id uuid := auth.uid();
begin
  if v_caller_id is null then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  return query
  select
    ps.id,
    ps.booking_id,
    ps.user_id,
    ps.started_at,
    ps.booked_end_at,
    ps.ended_at,
    ps.status,
    ps.auto_ended,
    ps.ended_by_admin,
    ps.duration_minutes,
    b.reference,
    sl.code,
    sl.level_code,
    b.plate_snapshot,
    coalesce((
      select sum(oc.total_paise)
      from public.overstay_charges oc
      where oc.session_id = ps.id
    ), 0)::int
  from public.parking_sessions ps
  join public.bookings       b  on b.id  = ps.booking_id
  join public.parking_slots  sl on sl.id = b.slot_id
  where (ps.id = p_session_id or ps.booking_id = p_session_id)
    and (ps.user_id = v_caller_id or public.is_admin());
end;
$$;

-- ── 11. FUNCTION: admin_list_sessions ─────────────────────────────────────
create or replace function public.admin_list_sessions(
  p_status    text default null,
  p_search    text default null,   -- searches plate or slot code
  p_page      int  default 1,
  p_page_size int  default 20      -- capped at 50
)
returns table (
  session_id        uuid,
  booking_id        uuid,
  user_id           uuid,
  started_at        timestamptz,
  booked_end_at     timestamptz,
  ended_at          timestamptz,
  status            text,
  auto_ended        boolean,
  ended_by_admin    boolean,
  duration_minutes  int,
  booking_reference text,
  slot_code         text,
  level_code        text,
  plate_snapshot    text,
  user_full_name    text,
  overstay_total_paise int,
  total_count       bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id uuid := auth.uid();
  v_offset    int  := greatest(0, (p_page - 1)) * least(p_page_size, 50);
  v_limit     int  := least(coalesce(p_page_size, 20), 50);
begin
  if v_caller_id is null then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;
  if not public.is_admin() then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  return query
  select
    ps.id,
    ps.booking_id,
    ps.user_id,
    ps.started_at,
    ps.booked_end_at,
    ps.ended_at,
    ps.status,
    ps.auto_ended,
    ps.ended_by_admin,
    ps.duration_minutes,
    b.reference,
    sl.code,
    sl.level_code,
    b.plate_snapshot,
    pr.full_name,
    coalesce((
      select sum(oc.total_paise)
      from public.overstay_charges oc
      where oc.session_id = ps.id
    ), 0)::int,
    count(*) over() as total_count
  from public.parking_sessions ps
  join public.bookings       b  on b.id  = ps.booking_id
  join public.parking_slots  sl on sl.id = b.slot_id
  left join public.profiles  pr on pr.id = ps.user_id
  where (p_status is null or ps.status = p_status)
    and (
      p_search is null
      or b.plate_snapshot ilike '%' || p_search || '%'
      or sl.code          ilike '%' || p_search || '%'
    )
  order by ps.started_at desc
  limit v_limit offset v_offset;
end;
$$;

-- ── 12. GRANT / REVOKE ────────────────────────────────────────────────────
revoke execute on function public.create_session_on_confirm()           from public, anon;
revoke execute on function public.generate_overstay_receipt_number()    from public, anon;
grant  execute on function public.generate_overstay_receipt_number()    to authenticated;

revoke execute on function public.get_active_session(uuid)              from public, anon;
grant  execute on function public.get_active_session(uuid)              to authenticated;

revoke execute on function public.end_session(uuid)                     from public, anon;
grant  execute on function public.end_session(uuid)                     to authenticated;

revoke execute on function public.list_my_sessions(text, int, int)      from public, anon;
grant  execute on function public.list_my_sessions(text, int, int)      to authenticated;

revoke execute on function public.get_session(uuid)                     from public, anon;
grant  execute on function public.get_session(uuid)                     to authenticated;

revoke execute on function public.admin_list_sessions(text, text, int, int) from public, anon;
grant  execute on function public.admin_list_sessions(text, text, int, int) to authenticated;
