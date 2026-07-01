-- Shareable read-only Boss Pro workshop dashboard links (token in URL, no login).

alter table public.contacts
  add column if not exists dashboard_share_token uuid default gen_random_uuid();

update public.contacts
set dashboard_share_token = gen_random_uuid()
where dashboard_share_token is null;

alter table public.contacts
  alter column dashboard_share_token set not null;

create unique index if not exists contacts_dashboard_share_token_key
  on public.contacts (dashboard_share_token);

comment on column public.contacts.dashboard_share_token is
  'Secret token for public /dashboard/{coachSlug}/{businessSlug}/{token} workshop views.';
