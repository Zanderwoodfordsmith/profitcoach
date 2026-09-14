-- Remember the CRM contact created when a pool person is opened,
-- so later clicks can skip find-or-create.

alter table public.coach_lead_list_items
  add column if not exists contact_id uuid references public.contacts (id) on delete set null;

create index if not exists coach_lead_list_items_contact_id_idx
  on public.coach_lead_list_items (contact_id)
  where contact_id is not null;

comment on column public.coach_lead_list_items.contact_id is
  'Prospect contact created or matched when this pool person was opened.';

notify pgrst, 'reload schema';
