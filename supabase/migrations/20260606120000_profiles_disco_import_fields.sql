-- Extra profile fields for Disco CSV import and coach directory context.
-- Includes `timezone` here too so a single SQL run on older DBs matches the import script.

alter table public.profiles add column if not exists timezone text;

alter table public.profiles add column if not exists discord_user_id text;
alter table public.profiles add column if not exists industry text;
alter table public.profiles add column if not exists previous_company text;
alter table public.profiles add column if not exists member_since_note text;
alter table public.profiles add column if not exists disco_last_seen_on date;
alter table public.profiles add column if not exists disco_community_joined_on date;
alter table public.profiles add column if not exists membership_tier text;
alter table public.profiles add column if not exists coaching_income_reported_2024 text;

comment on column public.profiles.discord_user_id is
  'Discord snowflake stored as text (avoids loss of precision in JSON/JS numbers).';
comment on column public.profiles.member_since_note is
  'Free-text “member since” from Disco; may differ from disco_community_joined_on.';
comment on column public.profiles.disco_last_seen_on is
  'Last seen on Disco (date only from export).';
comment on column public.profiles.disco_community_joined_on is
  'Joined community on Disco (date from export).';
comment on column public.profiles.membership_tier is
  'Parsed tier label: Part-time, Professional, or Elite.';
comment on column public.profiles.coaching_income_reported_2024 is
  'Raw “2024 Coaching Income” text from import spreadsheet.';

create index if not exists profiles_discord_user_id_idx
  on public.profiles (discord_user_id)
  where discord_user_id is not null;
