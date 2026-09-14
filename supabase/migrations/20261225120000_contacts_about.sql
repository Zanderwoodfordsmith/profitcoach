-- LinkedIn / Sales Nav profile About text (distinct from headline).
alter table public.contacts
  add column if not exists about text;

comment on column public.contacts.about is
  'Optional LinkedIn About / summary text (e.g. Sales Nav or profile import).';
