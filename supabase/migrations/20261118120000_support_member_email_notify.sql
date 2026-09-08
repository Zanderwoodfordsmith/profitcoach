-- Member email notify preference + debounced outbound notify queue.

alter table public.community_feedback_reports
  add column if not exists member_notify_email boolean not null default true;

alter table public.community_feedback_reports
  add column if not exists email_notify_after timestamptz;

alter table public.community_feedback_reports
  add column if not exists email_notify_last_sent_at timestamptz;

comment on column public.community_feedback_reports.member_notify_email is
  'When true, member wants email when support replies (admin may still override per reply).';

comment on column public.community_feedback_reports.email_notify_after is
  'Send queued reply email at/after this time (debounce window). Null = nothing queued.';

comment on column public.community_feedback_reports.email_notify_last_sent_at is
  'Last time a support-reply notification email was sent for this ticket.';

create index if not exists community_feedback_reports_email_notify_after_idx
  on public.community_feedback_reports (email_notify_after)
  where email_notify_after is not null;

-- Members may flip only their own email-notify preference.
create or replace function public.set_support_ticket_notify_email(
  p_report_id uuid,
  p_notify boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  update public.community_feedback_reports
  set member_notify_email = p_notify
  where id = p_report_id
    and (
      created_by = auth.uid()
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.role = 'admin'
      )
    );
end;
$fn$;

revoke all on function public.set_support_ticket_notify_email(uuid, boolean) from public;
grant execute on function public.set_support_ticket_notify_email(uuid, boolean) to authenticated;
