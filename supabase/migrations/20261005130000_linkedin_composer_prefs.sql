-- Composer chrome + quote-card prefs (OAuth cannot return LinkedIn headline).
alter table public.linkedin_member_connections
  add column if not exists display_headline text null;

alter table public.linkedin_member_connections
  add column if not exists website_label text null;

alter table public.linkedin_member_connections
  add column if not exists website_url text null;

alter table public.linkedin_member_connections
  add column if not exists quote_handle text null;
