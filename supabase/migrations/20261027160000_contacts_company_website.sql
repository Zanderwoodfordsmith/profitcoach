-- Company website for prospects (from LeadRocks enrichment or manual entry)
alter table public.contacts
  add column if not exists company_website text;

comment on column public.contacts.company_website is
  'Public company website URL for the contact (http/https).';
