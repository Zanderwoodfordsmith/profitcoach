-- Launches (Admin → Coaches → Launch view): BCA's next-step note per coach and
-- the order Zander wants to work through them (28 Nov 2026). Admin only.
alter table public.coaches
  add column if not exists launch_note text,
  add column if not exists launch_order integer,
  add column if not exists launch_note_updated_at timestamptz;
