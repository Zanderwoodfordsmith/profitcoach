-- Open Profile + LinkedIn Premium from Sales Nav search (Harvest Short /
-- Unipile search when present). Nullable: Unipile search often omits Open Profile.

alter table public.leadrocks_leads
  add column if not exists open_profile boolean,
  add column if not exists linkedin_premium boolean;

comment on column public.leadrocks_leads.open_profile is
  'LinkedIn Open Profile — anyone can InMail without a credit. Null when the scrape did not include the flag.';
comment on column public.leadrocks_leads.linkedin_premium is
  'Prospect has LinkedIn Premium / Sales Nav. Null when unknown.';

create index if not exists leadrocks_leads_open_profile_idx
  on public.leadrocks_leads (open_profile)
  where open_profile is true;

alter table public.coach_lead_list_items
  add column if not exists open_profile boolean,
  add column if not exists linkedin_premium boolean;

comment on column public.coach_lead_list_items.open_profile is
  'LinkedIn Open Profile from Sales Nav import. Null when unknown.';
comment on column public.coach_lead_list_items.linkedin_premium is
  'Prospect has LinkedIn Premium from Sales Nav import. Null when unknown.';

create index if not exists coach_lead_list_items_open_profile_idx
  on public.coach_lead_list_items (open_profile)
  where open_profile is true;

-- Harvest Short payloads live at raw.sales_nav.openProfile / premium.
update public.leadrocks_leads
set
  open_profile = (raw -> 'sales_nav' ->> 'openProfile') = 'true'
where open_profile is null
  and (
    raw -> 'sales_nav' ? 'openProfile'
    or raw -> 'sales_nav' ? 'open_profile'
    or raw -> 'sales_nav' ? 'is_open_profile'
    or raw ? 'openProfile'
  );

update public.leadrocks_leads
set
  linkedin_premium = coalesce(
    (raw -> 'sales_nav' ->> 'premium') = 'true',
    (raw -> 'sales_nav' ->> 'is_premium') = 'true',
    (raw ->> 'premium') = 'true',
    (raw ->> 'is_premium') = 'true'
  )
where linkedin_premium is null
  and (
    raw -> 'sales_nav' ? 'premium'
    or raw -> 'sales_nav' ? 'is_premium'
    or raw ? 'premium'
    or raw ? 'is_premium'
  );
