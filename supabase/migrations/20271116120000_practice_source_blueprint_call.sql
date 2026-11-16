-- Pam's notes from the Blueprint Call (her Ideal Client Profile and Avatar
-- docs) and the call's own transcript, kept beside the BCA sales calls so
-- Ava and the Blueprint writers read them (16 Nov).

alter table public.practice_source_transcripts
  drop constraint if exists practice_source_transcripts_source_check;

alter table public.practice_source_transcripts
  add constraint practice_source_transcripts_source_check
  check (source in ('bca_sales_call', 'blueprint_call', 'blueprint_call_notes'));

comment on table public.practice_source_transcripts is
  'Onboarding sources Ava and the Blueprint writers read: BCA sales calls, the Blueprint Call transcript, and Pam''s notes from it.';
