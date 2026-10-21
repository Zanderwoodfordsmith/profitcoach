-- Roadmap jobs: human-readable job numbers (BLD-0012 style in the UI), so a
-- job can be referenced by number the way support tickets use SUP-0410.
-- Also retires the beat1 / beat2 areas (September relaunch plan): their jobs
-- move to general.

create sequence if not exists public.roadmap_job_number_seq
  as bigint
  start with 1
  increment by 1
  owned by none;

alter table public.roadmap_jobs
  add column if not exists job_number bigint;

do $$
declare
  rec record;
begin
  for rec in
    select id
    from public.roadmap_jobs
    where job_number is null
    order by created_at asc, id asc
  loop
    update public.roadmap_jobs
    set job_number = nextval('public.roadmap_job_number_seq')
    where id = rec.id;
  end loop;
end $$;

alter table public.roadmap_jobs
  alter column job_number set default nextval('public.roadmap_job_number_seq');

alter table public.roadmap_jobs
  alter column job_number set not null;

create unique index if not exists roadmap_jobs_job_number_uidx
  on public.roadmap_jobs (job_number);

update public.roadmap_jobs
set area = 'general', updated_at = now()
where area in ('beat1', 'beat2');
