-- Staff replies composed in the support inbox and sent later.

create table if not exists public.support_scheduled_replies (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  report_id uuid not null references public.community_feedback_reports(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  body text not null default '',
  media jsonb,
  email_notify boolean not null default false,
  scheduled_for timestamptz not null,
  status text not null default 'scheduled',
  reply_id uuid references public.community_feedback_replies(id) on delete set null,
  attempts integer not null default 0,
  last_error text,
  constraint support_scheduled_replies_body_max
    check (char_length(body) <= 10000),
  constraint support_scheduled_replies_has_content
    check (
      char_length(trim(body)) > 0
      or (
        media is not null
        and media <> 'null'::jsonb
        and media <> '[]'::jsonb
      )
    ),
  constraint support_scheduled_replies_status_check
    check (status in ('scheduled', 'sending', 'sent', 'failed', 'cancelled'))
);

create index if not exists support_scheduled_replies_report_idx
  on public.support_scheduled_replies (report_id, scheduled_for);

create index if not exists support_scheduled_replies_due_idx
  on public.support_scheduled_replies (scheduled_for)
  where status = 'scheduled';

alter table public.support_scheduled_replies enable row level security;

drop policy if exists "Admins read support scheduled replies"
  on public.support_scheduled_replies;
create policy "Admins read support scheduled replies"
  on public.support_scheduled_replies
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins insert support scheduled replies"
  on public.support_scheduled_replies;
create policy "Admins insert support scheduled replies"
  on public.support_scheduled_replies
  for insert
  to authenticated
  with check (
    public.is_admin()
    and exists (
      select 1
      from public.profiles author
      where author.id = created_by
        and author.role in ('coach', 'admin')
    )
  );

drop policy if exists "Admins update support scheduled replies"
  on public.support_scheduled_replies;
create policy "Admins update support scheduled replies"
  on public.support_scheduled_replies
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update on public.support_scheduled_replies to authenticated;
