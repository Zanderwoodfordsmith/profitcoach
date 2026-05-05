-- In-app feedback/issues submitted by community staff.

create table if not exists public.community_feedback_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('bug', 'feature', 'general')),
  title text,
  details text not null,
  contact_email text,
  page_path text,
  user_agent text,
  status text not null default 'new' check (status in ('new', 'in_review', 'resolved'))
);

create index if not exists community_feedback_reports_created_at_idx
  on public.community_feedback_reports (created_at desc);

create index if not exists community_feedback_reports_status_idx
  on public.community_feedback_reports (status, created_at desc);

create or replace function public.set_community_feedback_reports_updated_at()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$;

drop trigger if exists community_feedback_reports_updated_at_trg
  on public.community_feedback_reports;
create trigger community_feedback_reports_updated_at_trg
before update on public.community_feedback_reports
for each row
execute procedure public.set_community_feedback_reports_updated_at();

alter table public.community_feedback_reports enable row level security;

drop policy if exists "Staff insert own community feedback reports"
  on public.community_feedback_reports;
create policy "Staff insert own community feedback reports"
  on public.community_feedback_reports for insert
  to authenticated
  with check (
    public.is_staff_community()
    and created_by = auth.uid()
  );

drop policy if exists "Admins read community feedback reports"
  on public.community_feedback_reports;
create policy "Admins read community feedback reports"
  on public.community_feedback_reports for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

drop policy if exists "Admins update community feedback reports"
  on public.community_feedback_reports;
create policy "Admins update community feedback reports"
  on public.community_feedback_reports for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );
