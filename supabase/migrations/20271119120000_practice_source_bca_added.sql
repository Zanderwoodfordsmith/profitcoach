-- Sources BCA adds by hand on Admin → Coaches → Sources (19 Nov): pasted
-- notes, voice notes and videos a coach sends us. Ava and the Blueprint
-- writers read them beside the calls. Uploaded files stay in a private bucket.

alter table public.practice_source_transcripts
  drop constraint if exists practice_source_transcripts_source_check;

alter table public.practice_source_transcripts
  add constraint practice_source_transcripts_source_check
  check (source in ('bca_sales_call', 'blueprint_call', 'blueprint_call_notes', 'bca_added'));

alter table public.practice_source_transcripts
  add column if not exists file_path text,
  add column if not exists added_by uuid references public.profiles (id) on delete set null;

insert into storage.buckets (id, name, public, file_size_limit)
values ('coach-sources', 'coach-sources', false, 524288000)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;

comment on table public.practice_source_transcripts is
  'Onboarding sources Ava and the Blueprint writers read: BCA sales calls, the Blueprint Call transcript, Pam''s notes from it, and what BCA adds by hand (bca_added).';
