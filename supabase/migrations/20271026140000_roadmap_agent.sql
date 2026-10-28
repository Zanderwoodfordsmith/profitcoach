-- Hand a card to Claude: a cloud Claude session builds the card, posts progress
-- lines to it, and the local dev server (3002) pulls the finished change in.
-- Additive only.
--
-- The cloud session gets a one-time key for its one card (only its hash is
-- stored). The three functions below are the only thing that key opens: read
-- the card, add a progress line, finish. The key dies when the run finishes.

alter table public.roadmap_jobs
  add column if not exists agent_status text,
  add column if not exists agent_branch text,
  add column if not exists agent_session_url text,
  add column if not exists agent_log jsonb not null default '[]'::jsonb,
  add column if not exists agent_token_hash text,
  add column if not exists agent_head_sha text,
  add column if not exists agent_applied_sha text,
  add column if not exists agent_applied_at timestamptz,
  add column if not exists agent_pull_error text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'roadmap_jobs_agent_status_check') then
    alter table public.roadmap_jobs
      add constraint roadmap_jobs_agent_status_check
      check (agent_status is null or agent_status in ('queued', 'working', 'done', 'failed'));
  end if;
end $$;

-- The row for a job number, if the key matches and the run is still open.
create or replace function public.roadmap_agent_job(p_job bigint, p_token text)
returns public.roadmap_jobs
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.roadmap_jobs
  where job_number = p_job
    and agent_status in ('queued', 'working')
    and agent_token_hash is not null
    and agent_token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
$$;

revoke all on function public.roadmap_agent_job(bigint, text) from public, anon, authenticated;

-- One progress line on the card (newest last, last 200 kept).
create or replace function public.roadmap_agent_note(p_job bigint, p_token text, p_text text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  j public.roadmap_jobs;
begin
  j := public.roadmap_agent_job(p_job, p_token);
  if j.id is null then
    raise exception 'Not allowed';
  end if;
  update public.roadmap_jobs
  set agent_status = 'working',
      agent_log = (
        select coalesce(jsonb_agg(e order by n), '[]'::jsonb)
        from (
          select e, n
          from jsonb_array_elements(
            agent_log || jsonb_build_array(jsonb_build_object('at', now(), 'text', left(coalesce(p_text, ''), 300), 'by', 'claude'))
          ) with ordinality as t(e, n)
          order by n desc
          limit 200
        ) last
      ),
      updated_at = now()
  where id = j.id;
end $$;

-- The brief for the session: the card and everything said on it so far.
create or replace function public.roadmap_agent_brief(p_job bigint, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  j public.roadmap_jobs;
begin
  j := public.roadmap_agent_job(p_job, p_token);
  if j.id is null then
    raise exception 'Not allowed';
  end if;
  perform public.roadmap_agent_note(p_job, p_token, 'Read the card');
  return jsonb_build_object(
    'job_number', j.job_number,
    'title', j.title,
    'project', j.project,
    'done_when', j.done_when,
    'notes', j.notes,
    'checklist', j.checklist,
    'comments', j.comments,
    'app_path', j.app_path,
    'branch', j.agent_branch,
    'progress_so_far', j.agent_log
  );
end $$;

-- Finish: record the branch and commit, put the report lines at the top of the
-- notes (replacing the last report), move the card to Review, kill the key.
create or replace function public.roadmap_agent_finish(
  p_job bigint,
  p_token text,
  p_ok boolean,
  p_branch text,
  p_sha text,
  p_report text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  j public.roadmap_jobs;
  rest text;
begin
  j := public.roadmap_agent_job(p_job, p_token);
  if j.id is null then
    raise exception 'Not allowed';
  end if;
  perform public.roadmap_agent_note(
    p_job,
    p_token,
    case when p_ok then 'Done. Waiting for 3002 to pull it in.' else 'Stopped: ' || left(coalesce(p_report, ''), 250) end
  );
  rest := regexp_replace(coalesce(j.notes, ''), '^(Where to look:|I checked:|You check:)[^\n]*\n?', '', 'gn');
  rest := regexp_replace(rest, '^\s+', '');
  update public.roadmap_jobs
  set agent_status = case when p_ok then 'done' else 'failed' end,
      agent_token_hash = null,
      agent_branch = coalesce(nullif(left(coalesce(p_branch, ''), 120), ''), agent_branch),
      agent_head_sha = case when p_ok then nullif(left(coalesce(p_sha, ''), 64), '') else agent_head_sha end,
      agent_pull_error = null,
      notes = case
        when p_ok and coalesce(p_report, '') <> '' then left(p_report, 4000) || case when rest <> '' then E'\n\n' || rest else '' end
        else notes
      end,
      status = case when p_ok then 'review' else status end,
      updated_at = now()
  where id = j.id;
end $$;

grant execute on function public.roadmap_agent_brief(bigint, text) to anon;
grant execute on function public.roadmap_agent_note(bigint, text, text) to anon;
grant execute on function public.roadmap_agent_finish(bigint, text, boolean, text, text, text) to anon;

-- 3002 listens for cards that finish (service key only; RLS still keeps others out).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'roadmap_jobs'
  ) then
    alter publication supabase_realtime add table public.roadmap_jobs;
  end if;
end $$;
