-- Support ticket types: match Story OS categories + enable realtime for live chat.

alter table public.community_feedback_reports
  drop constraint if exists community_feedback_reports_type_check;

alter table public.community_feedback_reports
  add constraint community_feedback_reports_type_check
  check (type in ('question', 'bug', 'idea', 'billing', 'other'));

do $$
begin
  alter publication supabase_realtime add table public.community_feedback_replies;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.community_feedback_reports;
exception
  when duplicate_object then null;
end $$;
