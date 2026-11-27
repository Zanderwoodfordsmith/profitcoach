-- Coaches save their own campaign templates (job 297).
-- coach_id null = BCA's library (Admin → Campaign library); set = that coach's
-- own template, seen only by them. The admin library ignores coach rows.

alter table public.campaign_library_items
  add column if not exists coach_id uuid references public.coaches (id) on delete cascade;

create index if not exists campaign_library_items_coach_idx
  on public.campaign_library_items (coach_id, updated_at desc)
  where coach_id is not null;
