-- ============================================================
-- Migration: profiles table with roles
-- Run this once in the Supabase SQL Editor (top to bottom).
-- ============================================================

-- ── 1. PROFILES TABLE ────────────────────────────────────────
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  phone       text,
  avatar_url  text,
  role        text not null default 'member'
                check (role in ('member', 'admin', 'staff')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is
  'One row per auth user; role is controlled only via direct SQL (never via API).';

-- ── 2. updated_at TRIGGER ────────────────────────────────────
-- Keeps updated_at current on every row change.
create or replace function public.set_updated_at()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ── 3. BLOCK ROLE CHANGES THROUGH THE API ────────────────────
-- If auth.uid() is not null the request came through the API.
-- Role may only be changed from the SQL Editor / service context.
create or replace function public.prevent_role_change_via_api()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if auth.uid() is not null and new.role <> old.role then
    raise exception
      'Role changes are not allowed through the API. '
      'Use the Supabase SQL Editor or a privileged service context.'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

-- This trigger must fire BEFORE set_updated_at so the role check
-- happens on the original NEW values.
create trigger profiles_prevent_role_change
  before update on public.profiles
  for each row execute function public.prevent_role_change_via_api();

-- ── 4. AUTO-CREATE PROFILE ON SIGN-UP ───────────────────────
-- Security definer so it can write to public.profiles without
-- granting INSERT to authenticated/anon roles.
-- Role is ALWAYS forced to 'member' — we never trust raw_user_meta_data.
create or replace function public.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    -- Copy display name from metadata if provided, otherwise null
    (new.raw_user_meta_data ->> 'full_name'),
    'member'   -- ALWAYS 'member'; never read role from user-supplied metadata
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Only the Postgres superuser / service context should call this.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── 5. is_admin() HELPER ─────────────────────────────────────
-- Returns true when the calling user's profile has role = 'admin'.
-- security definer so it can read profiles even before RLS policies
-- are evaluated (used inside RLS policy expressions).
create or replace function public.is_admin()
  returns boolean
  language plpgsql
  security definer
  set search_path = ''
  stable
as $$
begin
  return exists (
    select 1
    from   public.profiles
    where  id   = auth.uid()
    and    role = 'admin'
  );
end;
$$;

-- Only authenticated users (never anon) may call is_admin().
revoke execute on function public.is_admin() from public, anon;
grant  execute on function public.is_admin() to authenticated;

-- ── 6. ROW LEVEL SECURITY ────────────────────────────────────
alter table public.profiles enable row level security;

-- A user can always read their own profile.
create policy "profiles: user reads own row"
  on public.profiles
  for select
  using (id = auth.uid());

-- An admin can read every profile.
create policy "profiles: admin reads all rows"
  on public.profiles
  for select
  using (public.is_admin());

-- A user can update their own profile (but the role-change trigger
-- blocks any attempt to change the role column via the API).
create policy "profiles: user updates own row"
  on public.profiles
  for update
  using      (id = auth.uid())
  with check (id = auth.uid());

-- No INSERT policy — handle_new_user() inserts as security definer.
-- No DELETE policy — profiles are deleted via ON DELETE CASCADE from auth.users.

-- ── 7. BACKFILL EXISTING USERS ───────────────────────────────
-- Insert a 'member' profile for any auth user who doesn't have one yet.
insert into public.profiles (id, full_name, role)
select
  u.id,
  (u.raw_user_meta_data ->> 'full_name'),
  'member'
from auth.users u
where not exists (
  select 1 from public.profiles p where p.id = u.id
);

-- ── 8. MANUAL ADMIN PROMOTION ────────────────────────────────
-- !! MANUAL -- DO NOT RUN AUTOMATICALLY !!
--
-- To promote your account to admin, run this in the SQL Editor,
-- replacing MY_EMAIL_HERE with your actual email address:
--
--   update public.profiles
--   set    role = 'admin'
--   where  id = (select id from auth.users where email = 'MY_EMAIL_HERE');
--
-- To demote back to member:
--
--   update public.profiles
--   set    role = 'member'
--   where  id = (select id from auth.users where email = 'MY_EMAIL_HERE');
--
-- To promote to staff:
--
--   update public.profiles
--   set    role = 'staff'
--   where  id = (select id from auth.users where email = 'MY_EMAIL_HERE');
--
-- These statements work because auth.uid() IS NULL in the SQL Editor
-- session, so the prevent_role_change_via_api trigger allows them.
-- !! END MANUAL BLOCK !!
