-- Assignments follow the same coach_id model as coach_action_items: profiles.id (auth user).
-- Admins testing My Actions and coaches without a coaches directory row still need to accept plans.

alter table public.coach_action_plan_assignments
  drop constraint if exists coach_action_plan_assignments_coach_id_fkey;

alter table public.coach_action_plan_assignments
  add constraint coach_action_plan_assignments_coach_id_fkey
  foreign key (coach_id) references public.profiles(id) on delete cascade;
