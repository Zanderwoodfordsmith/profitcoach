-- When the ticket owner opens chat (marks read), cancel any pending
-- "staff replied" email and advance the watermark so a later notify
-- only covers new staff replies. Admins marking read while viewing a
-- ticket must not cancel the member's email.

create or replace function public.mark_support_ticket_read(p_report_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  update public.community_feedback_reports
  set
    coach_last_read_at = now(),
    email_notify_after = case
      when created_by = auth.uid() then null
      else email_notify_after
    end,
    email_notify_last_sent_at = case
      when created_by = auth.uid() then now()
      else email_notify_last_sent_at
    end
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
