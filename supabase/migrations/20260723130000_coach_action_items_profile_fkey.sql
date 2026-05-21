-- Personal action items are keyed by auth user (profiles.id), not only coaches directory rows.
-- Admins using /admin/signature/actions may not have a coaches row; signature scores use profiles too.

alter table public.coach_action_items
  drop constraint if exists coach_action_items_coach_id_fkey;

alter table public.coach_action_items
  add constraint coach_action_items_coach_id_fkey
  foreign key (coach_id) references public.profiles(id) on delete cascade;
