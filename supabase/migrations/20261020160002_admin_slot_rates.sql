-- ============================================================================
-- ParkGrid One - Admin Slot Rates & Tariffs Management
-- ============================================================================
-- PURPOSE:
--   Allows administrators to retrieve and update hourly tariffs per slot type
--   across all physical bays in public.parking_slots, with full audit logging.
-- Ensure admin_audit_log accepts 'parking_slots' as a valid record_type
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'admin_audit_log_record_type_check'
      and conrelid = 'public.admin_audit_log'::regclass
  ) then
    alter table public.admin_audit_log drop constraint admin_audit_log_record_type_check;
    alter table public.admin_audit_log add constraint admin_audit_log_record_type_check
      check (record_type in ('booking', 'user', 'payment', 'settings', 'parking_slots'));
  end if;
end;
$$;

create or replace function public.admin_get_slot_rates()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id uuid := auth.uid();
  v_rates     jsonb;
begin
  if v_caller_id is null or not public.is_admin() then
    raise exception 'Access denied: administrator privileges required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'standard_rate_paise', coalesce(
      (select hourly_rate_paise from public.parking_slots where slot_type = 'standard' limit 1),
      5000
    ),
    'ev_rate_paise', coalesce(
      (select hourly_rate_paise from public.parking_slots where slot_type = 'ev' limit 1),
      7000
    ),
    'accessible_rate_paise', coalesce(
      (select hourly_rate_paise from public.parking_slots where slot_type = 'accessible' limit 1),
      5000
    )
  ) into v_rates;

  return v_rates;
end;
$$;

revoke all on function public.admin_get_slot_rates() from public, anon;
grant execute on function public.admin_get_slot_rates() to authenticated;

create or replace function public.admin_update_slot_rates(
  p_standard_rate_paise   int,
  p_ev_rate_paise         int,
  p_accessible_rate_paise int,
  p_reason                text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id      uuid := auth.uid();
  v_old_rates      jsonb;
  v_new_rates      jsonb;
  v_trimmed_reason text;
  v_now            timestamptz := pg_catalog.now();
begin
  -- 1. Security Check
  if v_caller_id is null or not public.is_admin() then
    raise exception 'Access denied: administrator privileges required' using errcode = '42501';
  end if;

  -- 2. Validate Reason
  v_trimmed_reason := trim(coalesce(p_reason, ''));
  if length(v_trimmed_reason) < 5 or length(v_trimmed_reason) > 300 then
    raise exception 'A valid reason between 5 and 300 characters is required' using errcode = 'P0001';
  end if;

  -- 3. Validate Rate Boundaries (₹10/hr to ₹1,000/hr)
  if p_standard_rate_paise < 1000 or p_standard_rate_paise > 100000 then
    raise exception 'Standard rate must be between 1000 and 100000 paise (₹10 to ₹1,000/hr)' using errcode = 'P0001';
  end if;

  if p_ev_rate_paise < 1000 or p_ev_rate_paise > 100000 then
    raise exception 'EV rate must be between 1000 and 100000 paise (₹10 to ₹1,000/hr)' using errcode = 'P0001';
  end if;

  if p_accessible_rate_paise < 1000 or p_accessible_rate_paise > 100000 then
    raise exception 'Accessible rate must be between 1000 and 100000 paise (₹10 to ₹1,000/hr)' using errcode = 'P0001';
  end if;

  -- 4. Capture current rates
  v_old_rates := public.admin_get_slot_rates();

  -- 5. Update parking_slots table by slot_type
  update public.parking_slots
  set hourly_rate_paise = p_standard_rate_paise,
      updated_at = v_now
  where slot_type = 'standard';

  update public.parking_slots
  set hourly_rate_paise = p_ev_rate_paise,
      updated_at = v_now
  where slot_type = 'ev';

  update public.parking_slots
  set hourly_rate_paise = p_accessible_rate_paise,
      updated_at = v_now
  where slot_type = 'accessible';

  v_new_rates := jsonb_build_object(
    'standard_rate_paise', p_standard_rate_paise,
    'ev_rate_paise', p_ev_rate_paise,
    'accessible_rate_paise', p_accessible_rate_paise
  );

  -- 6. Write to admin audit log
  insert into public.admin_audit_log (
    actor_id,
    action,
    record_type,
    record_id,
    reason,
    old_data,
    new_data
  ) values (
    v_caller_id,
    'update_slot_rates',
    'parking_slots',
    'slot_types',
    v_trimmed_reason,
    v_old_rates,
    v_new_rates
  );

  return v_new_rates;
end;
$$;

revoke all on function public.admin_update_slot_rates(int, int, int, text) from public, anon;
grant execute on function public.admin_update_slot_rates(int, int, int, text) to authenticated;
