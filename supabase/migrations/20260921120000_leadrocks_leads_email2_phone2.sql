-- Second contact slots + export freshness for LeadRocks CSV / Apify imports.

alter table public.leadrocks_leads
  add column if not exists email_2 text;

alter table public.leadrocks_leads
  add column if not exists phone_2 text;

-- When the LeadRocks list was exported (from CSV filename date), not when we imported it.
alter table public.leadrocks_leads
  add column if not exists exported_at date;

create index if not exists leadrocks_leads_source_idx
  on public.leadrocks_leads (source);

create index if not exists leadrocks_leads_email_lower_idx
  on public.leadrocks_leads (lower(email));

create index if not exists leadrocks_leads_exported_at_idx
  on public.leadrocks_leads (exported_at);

-- Promote second contacts stored in raw during the pre-column CSV import.
update public.leadrocks_leads
set
  email_2 = coalesce(nullif(email_2, ''), nullif(raw->>'email_2', '')),
  phone_2 = coalesce(nullif(phone_2, ''), nullif(raw->>'phone_2', ''))
where source = 'leadrocks_csv'
  and (
    (email_2 is null and raw ? 'email_2')
    or (phone_2 is null and raw ? 'phone_2')
  );

-- This batch of UK owner CSVs was exported 2026-08-03 (filename date).
update public.leadrocks_leads
set exported_at = date '2026-08-03'
where source = 'leadrocks_csv'
  and exported_at is null;
