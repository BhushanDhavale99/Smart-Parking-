-- ============================================================================
-- ParkGrid One - Admin Role Promotion Script
-- ============================================================================
-- IMPORTANT: This is a manual script, NOT a database migration.
-- DO NOT place this file in supabase/migrations or run it automatically.
--
-- INSTRUCTIONS:
-- 1. Sign up through the ParkGrid One web app first so your account exists in auth.users.
-- 2. Open the Supabase Dashboard -> SQL Editor.
-- 3. Replace 'YOUR_EMAIL_HERE' on the line marked EDIT YOUR EMAIL HERE (the only place to change in the active code).
-- 4. Run this script.
--
-- WHY RUN THIS IN THE SQL EDITOR?
-- The `prevent_role_change_via_api` trigger strictly prevents role modifications
-- requested through the Supabase REST/GraphQL API (where auth.uid() is not null).
-- Direct SQL Editor sessions run with superuser / service privileges (auth.uid() is null),
-- which is the only authorized path to assign admin roles.
-- ============================================================================

-- zero rows returned = email not found or placeholder not replaced; sign up through the app first
with target_user as (
  select id, (raw_user_meta_data ->> 'full_name') as full_name
  from auth.users
  where lower(email) = lower(trim('YOUR_EMAIL_HERE'))  -- EDIT YOUR EMAIL HERE (only place to change)
)
insert into public.profiles (id, full_name, role, created_at, updated_at)
select id, full_name, 'admin', now(), now()
from target_user
on conflict (id) do update
set role = 'admin',
    updated_at = now()
returning (select email from auth.users where id = profiles.id) as email,
          role,
          full_name,
          updated_at;

-- ============================================================================
-- OPTIONAL: Demote back to member (uncomment and run if needed)
-- ============================================================================
-- update public.profiles
-- set    role       = 'member',
--        updated_at = now()
-- where  id = (select id from auth.users where lower(email) = lower('YOUR_EMAIL_HERE'));  -- EDIT YOUR EMAIL HERE

-- ============================================================================
-- OPTIONAL: List all admins (uncomment and run to audit)
-- ============================================================================
-- select u.email, p.role
-- from auth.users u
-- join public.profiles p on p.id = u.id
-- where p.role = 'admin';
