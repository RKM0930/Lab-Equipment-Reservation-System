-- ============================================================================
-- Laboratory Equipment Reservation System
-- Supabase / PostgreSQL schema
-- ----------------------------------------------------------------------------
-- Run this entire file in the Supabase Dashboard → SQL Editor.
-- It is safe to re-run: tables use IF NOT EXISTS and seed rows use ON CONFLICT.
--
-- Security note for the prototype:
-- This client-only demo talks to Supabase with the public anon key and does not
-- enable RLS because Clerk identities are not Supabase auth.uid() users. Before
-- production use, move mutations into SECURITY DEFINER functions or an edge
-- function, enable RLS, and remove the demo role switcher's privilege bypass.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Equipment catalog
-- ----------------------------------------------------------------------------
create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(),
  item_code text not null unique,
  name text not null,
  category text not null,
  total_qty integer not null,
  available_qty integer not null,
  created_at timestamptz not null default now(),

  constraint equipment_item_code_format_check
    check (item_code ~ '^[A-Z]{2,4}-[0-9]{3,4}$'),
  constraint equipment_name_not_blank_check
    check (length(btrim(name)) > 0),
  constraint equipment_category_not_blank_check
    check (length(btrim(category)) > 0),
  constraint equipment_total_positive_check
    check (total_qty > 0),
  constraint equipment_available_bounds_check
    check (available_qty >= 0 and available_qty <= total_qty)
);

comment on table public.equipment is
  'Shared laboratory equipment inventory. available_qty must always stay within [0, total_qty].';

-- ----------------------------------------------------------------------------
-- Reservations
-- ----------------------------------------------------------------------------
create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  reservation_code text not null unique,
  clerk_user_id text not null,
  borrower_name text not null,
  borrower_email text not null,
  equipment_id uuid not null references public.equipment(id) on delete restrict,
  item_code text not null,
  item_name text not null,
  quantity integer not null,
  reservation_date date not null,
  time_slot text not null,
  status text not null default 'ACTIVE',
  return_note text default '-',
  created_at timestamptz not null default now(),

  constraint reservations_clerk_user_not_blank_check
    check (length(btrim(clerk_user_id)) > 0),
  constraint reservations_borrower_name_not_blank_check
    check (length(btrim(borrower_name)) > 0),
  constraint reservations_email_format_check
    check (borrower_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  constraint reservations_item_code_format_check
    check (item_code ~ '^[A-Z]{2,4}-[0-9]{3,4}$'),
  constraint reservations_item_name_not_blank_check
    check (length(btrim(item_name)) > 0),
  constraint reservations_quantity_positive_check
    check (quantity > 0),
  constraint reservations_time_slot_format_check
    check (time_slot ~ '^([01][0-9]|2[0-3]):[0-5][0-9]-([01][0-9]|2[0-3]):[0-5][0-9]$'),
  -- Because the format is fixed to HH:MM-HH:MM, lexicographic comparison is
  -- equivalent to comparing minutes. This rejects inverted or identical times.
  constraint reservations_time_slot_order_check
    check (left(time_slot, 5) < right(time_slot, 5)),
  constraint reservations_status_check
    check (status in ('ACTIVE', 'RETURNED', 'CANCELLED'))
);

comment on table public.reservations is
  'Denormalized borrow records. Item code/name are snapshotted at reservation time.';

create index if not exists reservations_status_idx
  on public.reservations (status);
create index if not exists reservations_equipment_id_idx
  on public.reservations (equipment_id);
create index if not exists reservations_created_at_idx
  on public.reservations (created_at desc);

-- ----------------------------------------------------------------------------
-- Database-level date validation
-- CHECK constraints cannot safely depend on CURRENT_DATE, so a trigger handles
-- the "selected_date >= current_date" rule on insert and update.
-- Note: current_date is evaluated in the database (Supabase) time zone.
-- ----------------------------------------------------------------------------
create or replace function public.validate_reservation_dates()
returns trigger
language plpgsql
as $$
begin
  if new.reservation_date < current_date then
    raise exception 'Reservation date cannot be in the past.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists reservations_validate_dates on public.reservations;
create trigger reservations_validate_dates
  before insert or update of reservation_date on public.reservations
  for each row
  execute function public.validate_reservation_dates();

-- ----------------------------------------------------------------------------
-- Database-level lifecycle transition guard
-- Only ACTIVE records may move into RETURNED or CANCELLED. Repeating an
-- existing terminal status is also blocked. A system rollback back to ACTIVE is
-- allowed so a failed stock-restoration compensation can be recorded safely.
-- The application additionally uses conditional updates on status = 'ACTIVE'
-- to avoid duplicate returns and duplicate stock additions.
-- ----------------------------------------------------------------------------
create or replace function public.guard_reservation_lifecycle()
returns trigger
language plpgsql
as $$
begin
  if old.status <> 'ACTIVE'
     and new.status <> old.status
     and new.status in ('RETURNED', 'CANCELLED') then
    raise exception 'Only ACTIVE reservations can transition to RETURNED or CANCELLED.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists reservations_guard_lifecycle on public.reservations;
create trigger reservations_guard_lifecycle
  before update of status on public.reservations
  for each row
  execute function public.guard_reservation_lifecycle();

-- ----------------------------------------------------------------------------
-- Seed inventory (Laboratory 6 specification)
-- ----------------------------------------------------------------------------
insert into public.equipment (item_code, name, category, total_qty, available_qty)
values
  ('EQ-101', 'Digital Oscilloscope', 'Electronics', 5, 4),
  ('EQ-102', 'Arduino Uno R4 Kit', 'Embedded', 10, 10),
  ('EQ-103', 'Optical Microscope', 'Optics', 3, 3),
  ('EQ-104', 'Logic Analyzer 16-Ch', 'Electronics', 3, 3),
  ('EQ-105', 'Raspberry Pi 5 Kit', 'Computing', 5, 5)
on conflict (item_code) do nothing;

-- ============================================================================
-- Optional verification queries
-- ============================================================================
-- select item_code, name, total_qty, available_qty from public.equipment order by item_code;
-- select reservation_code, borrower_name, item_name, quantity, status
--   from public.reservations order by created_at desc;
