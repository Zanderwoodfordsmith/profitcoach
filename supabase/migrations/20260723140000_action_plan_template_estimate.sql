-- Store default time estimates on action plan template items.

alter table public.action_plan_template_items
  add column if not exists estimate text not null default '';
