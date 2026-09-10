-- Per-admin support reply drafts (cross-browser autosave). Text-only; tiny rows.

create table if not exists public.support_admin_reply_drafts (
  report_id uuid not null references public.community_feedback_reports(id) on delete cascade,
  admin_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  updated_at timestamptz not null default now(),
  primary key (report_id, admin_id),
  constraint support_admin_reply_drafts_body_nonempty
    check (char_length(trim(body)) > 0)
);

create index if not exists support_admin_reply_drafts_admin_updated_idx
  on public.support_admin_reply_drafts (admin_id, updated_at desc);

alter table public.support_admin_reply_drafts enable row level security;

drop policy if exists "Admins manage own support reply drafts"
  on public.support_admin_reply_drafts;
create policy "Admins manage own support reply drafts"
  on public.support_admin_reply_drafts
  for all
  to authenticated
  using (
    admin_id = auth.uid()
    and public.is_admin()
  )
  with check (
    admin_id = auth.uid()
    and public.is_admin()
  );
