-- Prospect job title on contacts; link coach action items to contacts for follow-ups.

alter table public.contacts
  add column if not exists job_title text;

alter table public.coach_action_items
  add column if not exists contact_id uuid references public.contacts(id) on delete set null;

create index if not exists coach_action_items_contact_id_idx
  on public.coach_action_items (contact_id)
  where contact_id is not null;
