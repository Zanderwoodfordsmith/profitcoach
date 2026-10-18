-- What a coach's clients look like, so BCA can target lookalikes and see which
-- channels actually produce clients. All optional.
alter table public.contacts
  add column if not exists client_sector text,
  add column if not exists client_revenue_band text,
  add column if not exists client_team_size text,
  add column if not exists client_source text,
  add column if not exists client_result text,
  add column if not exists client_fit smallint;

alter table public.contacts drop constraint if exists contacts_client_fit_range;
alter table public.contacts add constraint contacts_client_fit_range check (client_fit is null or (client_fit between 1 and 5));

comment on column public.contacts.client_source is 'How this client found the coach: linkedin_outreach, linkedin_content, referral, network, event, scorecard, ads, email, other.';
comment on column public.contacts.client_fit is '1 to 5: would the coach like ten more clients like this one?';
