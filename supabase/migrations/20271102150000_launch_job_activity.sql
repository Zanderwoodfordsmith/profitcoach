-- Job Activity (job 172): what Ava does on each coach's launch job, seen only
-- by BCA. Additive only: one new table and one new column.
--
-- launch_job_activity: one row per thing in a job's Activity tab.
--   kind 'note'    BCA talking to Ava about the job
--   kind 'ava'     Ava answering BCA
--   kind 'draft'   Ava's draft of the job's written sections (payload.sections),
--                  waiting for BCA to save it into the coach's Blueprint
--   kind 'message' a message Ava wants to send the coach in the job's chat
--   kind 'answers' answers Ava picked out of the coach's chat replies, to put
--                  into the Blueprint
--   kind 'event'   a line in the log ("Saved, as Ava wrote it")
-- status: open (waiting for BCA), saved, sent, dismissed, replaced (a newer
-- version took its place). Null for notes, replies and events.
-- edited: BCA changed it before saving or sending. Saved drafts with
-- edited = false are how we know a kind of job can go automatic.
--
-- Server only: RLS on, no policies, so only the service role reads or writes.
--
-- community_feedback_replies.as_ava: a chat message Ava wrote. created_by is
-- the admin who approved it; the chat shows it as Ava.

create table if not exists public.launch_job_activity (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null,
  job_key text not null,
  kind text not null check (kind in ('note', 'ava', 'draft', 'message', 'answers', 'event')),
  body text not null default '',
  payload jsonb not null default '{}'::jsonb,
  status text check (status in ('open', 'saved', 'sent', 'dismissed', 'replaced')),
  edited boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid
);

create index if not exists launch_job_activity_job_idx
  on public.launch_job_activity (coach_id, job_key, created_at);

create index if not exists launch_job_activity_open_idx
  on public.launch_job_activity (coach_id, job_key)
  where status = 'open';

alter table public.launch_job_activity enable row level security;
revoke all on public.launch_job_activity from anon, authenticated;
grant all on public.launch_job_activity to service_role;

alter table public.community_feedback_replies
  add column if not exists as_ava boolean not null default false;
