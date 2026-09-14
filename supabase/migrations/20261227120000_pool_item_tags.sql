-- Freeform tags on pool / lead-list people (same shape as contacts.prospect_tags).

alter table public.coach_lead_list_items
  add column if not exists tags text[] not null default '{}';

comment on column public.coach_lead_list_items.tags is
  'Freeform coach tags on a pool or list person.';

create index if not exists coach_lead_list_items_tags_gin
  on public.coach_lead_list_items using gin (tags);
