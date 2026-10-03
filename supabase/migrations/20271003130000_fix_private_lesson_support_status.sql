-- Private lesson Ask & Share posts create a support ticket.
-- Status 'new' was removed in 20261121120000; inserts were failing
-- community_feedback_reports_status_check and rolling the post back.

create or replace function public.create_support_ticket_from_private_lesson_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.post_scope = 'lesson_qa'
    and new.visibility = 'private'
    and not exists (
      select 1
      from public.community_feedback_reports r
      where r.community_post_id = new.id
    )
  then
    insert into public.community_feedback_reports (
      created_by,
      type,
      title,
      details,
      page_path,
      source,
      assigned_to,
      community_post_id,
      status
    ) values (
      new.author_id,
      'question',
      new.title,
      new.body,
      new.lesson_path,
      'lesson_private',
      '01df174c-646c-4a29-8e76-9d0132735434'::uuid,
      new.id,
      'open'
    );
  end if;
  return new;
end;
$fn$;
