-- Admin → Brand → Design: Zander's marks on each family of live app pieces
-- (buttons, cards, text styles...). One row per marked family. The pieces
-- themselves come from scripts/design-inventory.ts; label and kind are kept
-- here so the marks read on their own when Claude writes DESIGN.md.

create table if not exists public.design_marks (
  piece_id text primary key,
  kind text not null,
  label text not null,
  mark text check (mark in ('fits', 'no')),
  note text,
  marked_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.design_marks enable row level security;
-- Server only (the design marks API checks for an admin).
