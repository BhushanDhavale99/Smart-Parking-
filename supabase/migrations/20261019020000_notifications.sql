-- ============================================================================
-- Migration: 20261019020000_notifications.sql
-- Description: Ensure public.notifications table exists with all standard columns
--              (including 'body', 'message', 'title', etc.) to prevent trigger errors
--              during booking confirmation and payment processing.
-- ============================================================================

-- ── 1. CREATE TABLE IF NOT EXISTS ──────────────────────────────────────────
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Notification',
  body text,
  message text,
  type text not null default 'info',
  is_read boolean not null default false,
  read boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  link text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── 2. DEFENSIVE COLUMN ADDITIONS ──────────────────────────────────────────
-- In case public.notifications pre-existed without 'body' or other standard fields:
alter table public.notifications
  add column if not exists title text not null default 'Notification',
  add column if not exists body text,
  add column if not exists message text,
  add column if not exists type text not null default 'info',
  add column if not exists is_read boolean not null default false,
  add column if not exists read boolean not null default false,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists link text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- Ensure title has a safe default if previously created without one
alter table public.notifications
  alter column title set default 'Notification';

-- ── 3. SYNC HELPER TRIGGER: KEEP BODY, MESSAGE, AND READ STATUS IN SYNC ────
-- Ensures that whether a trigger inserts 'body' or 'message', both are populated.
create or replace function public.sync_notification_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.title is null or new.title = '' then
    new.title := 'Notification';
  end if;

  if (new.body is null or new.body = '') and new.message is not null then
    new.body := new.message;
  elsif (new.message is null or new.message = '') and new.body is not null then
    new.message := new.body;
  end if;

  if new.is_read is null and new.read is not null then
    new.is_read := new.read;
  elsif new.read is null and new.is_read is not null then
    new.read := new.is_read;
  end if;

  return new;
end;
$$;

drop trigger if exists notifications_sync_fields on public.notifications;
create trigger notifications_sync_fields
  before insert or update on public.notifications
  for each row execute function public.sync_notification_fields();

-- ── 4. ROW LEVEL SECURITY (RLS) ────────────────────────────────────────────
alter table public.notifications enable row level security;

drop policy if exists "notifications_select_policy" on public.notifications;
create policy "notifications_select_policy"
  on public.notifications for select to authenticated
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "notifications_insert_policy" on public.notifications;
create policy "notifications_insert_policy"
  on public.notifications for insert to authenticated
  with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "notifications_update_policy" on public.notifications;
create policy "notifications_update_policy"
  on public.notifications for update to authenticated
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "notifications_delete_policy" on public.notifications;
create policy "notifications_delete_policy"
  on public.notifications for delete to authenticated
  using (auth.uid() = user_id or public.is_admin());

-- ── 5. GRANTS ──────────────────────────────────────────────────────────────
revoke all on public.notifications from anon;
grant select, insert, update, delete on public.notifications to authenticated;

-- ── 6. RELOAD POSTGREST SCHEMA CACHE ───────────────────────────────────────
notify pgrst, 'reload schema';
