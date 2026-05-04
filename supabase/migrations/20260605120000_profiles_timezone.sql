-- App-wide display timezone (IANA), e.g. Africa/Johannesburg — used in settings / scheduling UX.
alter table public.profiles add column if not exists timezone text;
