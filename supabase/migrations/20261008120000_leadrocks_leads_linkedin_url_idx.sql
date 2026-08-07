-- Speed Sales Nav → shared cache matching on LinkedIn URL.
create index if not exists leadrocks_leads_linkedin_url_idx
  on public.leadrocks_leads (linkedin_url);

create index if not exists leadrocks_leads_linkedin_url_lower_idx
  on public.leadrocks_leads (lower(linkedin_url));
