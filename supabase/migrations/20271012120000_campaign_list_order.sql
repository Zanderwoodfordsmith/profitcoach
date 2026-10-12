-- Coach-chosen order for the campaigns list. Null keeps the default
-- playbook / recently-updated order until the coach drags the list.

alter table public.linkedin_campaigns
  add column if not exists list_order int;

create index if not exists linkedin_campaigns_coach_list_order_idx
  on public.linkedin_campaigns (coach_id, list_order);
