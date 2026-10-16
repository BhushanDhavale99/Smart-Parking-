-- ============================================================================
-- ParkGrid One - Parking Facility Seed Script
-- ============================================================================
-- PURPOSE:
--   Seeds the 5 parking levels and exactly 150 parking slots into the database.
--   Preserves the exact totals and type distributions from the operations mock:
--     - 5 Levels: B2, B1, G1, L1, L2 (30 bays each)
--     - 12 EV Charger Bays (Bays 01-06 on Ground G1 and Basement B1, ₹70/hr)
--     - 10 Accessible Bays (Bays 07-08 across all 5 levels, ₹50/hr)
--     - 128 Standard Bays (₹50/hr)
--     - Heavy vehicles allowed on G1, B1, and B2.
--
-- INSTRUCTIONS:
--   1. Run after applying the migration (20261016123000_parking_slots.sql).
--   2. Open the Supabase SQL Editor and execute this script.
--   3. This script is IDEMPOTENT (uses ON CONFLICT DO NOTHING); safe to re-run.
-- ============================================================================

-- ── 1. SEED LEVELS ───────────────────────────────────────────
insert into public.parking_levels (code, name, sort_order, allows_heavy)
values
  ('B2', 'Basement Level 2', 1, true),
  ('B1', 'Basement Level 1', 2, true),
  ('G1', 'Ground Floor',      3, true),
  ('L1', 'Upper Deck Level 1', 4, false),
  ('L2', 'Upper Deck Level 2', 5, false)
on conflict (code) do nothing;

-- ── 2. SEED 150 SLOTS (30 PER LEVEL) ─────────────────────────
insert into public.parking_slots (
  code,
  level_code,
  zone,
  bay_number,
  slot_type,
  has_ev_charger,
  hourly_rate_paise,
  admin_status
)
select
  l.code || '-' || lpad(b.bay_number::text, 2, '0') as code,
  l.code as level_code,
  case
    when (l.code in ('G1', 'B1') and b.bay_number <= 6) then 'EV'
    when (l.code in ('G1', 'B1') and b.bay_number <= 18) then 'A'
    when (l.code not in ('G1', 'B1') and b.bay_number <= 15) then 'A'
    else 'B'
  end as zone,
  b.bay_number,
  case
    when (l.code in ('G1', 'B1') and b.bay_number <= 6) then 'ev'
    when (b.bay_number in (7, 8)) then 'accessible'
    else 'standard'
  end as slot_type,
  case
    when (l.code in ('G1', 'B1') and b.bay_number <= 6) then true
    else false
  end as has_ev_charger,
  case
    when (l.code in ('G1', 'B1') and b.bay_number <= 6) then 7000 -- ₹70/hr for EV
    else 5000 -- ₹50/hr for Standard & Accessible
  end as hourly_rate_paise,
  'active' as admin_status
from (
  select unnest(array['B2', 'B1', 'G1', 'L1', 'L2']) as code
) l
cross join generate_series(1, 30) as b(bay_number)
order by l.code, b.bay_number
on conflict (code) do nothing;

-- ── 3. VERIFICATION QUERY ─────────────────────────────────────
-- Verifies the seeded slot distribution per level and type.
-- Total slots must equal 150.
select
  level_code,
  slot_type,
  count(*) as slot_count,
  min(hourly_rate_paise) as rate_paise
from public.parking_slots
group by rollup(level_code, slot_type)
order by level_code nulls last, slot_type nulls last;

select
  count(*) as total_slots,
  count(*) filter (where slot_type = 'ev') as ev_slots,
  count(*) filter (where slot_type = 'accessible') as accessible_slots,
  count(*) filter (where slot_type = 'standard') as standard_slots,
  count(*) filter (where has_ev_charger = true) as ev_chargers,
  count(*) filter (where admin_status = 'active') as active_slots
from public.parking_slots;
