-- Ticket and reply attachments, same jsonb shape as community posts/comments.
alter table public.community_feedback_reports
  add column if not exists media jsonb;

alter table public.community_feedback_replies
  add column if not exists media jsonb;

-- Allow image-only replies (community comments already allow this).
alter table public.community_feedback_replies
  drop constraint if exists community_feedback_replies_body_nonempty;

-- Lesson Q&A sync copies attachments both ways.
create or replace function public.sync_support_reply_to_lesson_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_post_id uuid;
  v_comment_id uuid;
begin
  if new.community_comment_id is not null then
    return new;
  end if;

  select r.community_post_id
  into v_post_id
  from public.community_feedback_reports r
  where r.id = new.report_id
    and r.community_post_id is not null;

  if v_post_id is null then
    return new;
  end if;

  insert into public.community_post_comments (
    post_id,
    author_id,
    body,
    media,
    support_reply_id
  ) values (
    v_post_id,
    new.created_by,
    new.body,
    new.media,
    new.id
  )
  returning id into v_comment_id;

  update public.community_feedback_replies
  set community_comment_id = v_comment_id
  where id = new.id;

  return new;
end;
$fn$;

create or replace function public.sync_lesson_comment_to_support_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_report_id uuid;
  v_reply_id uuid;
begin
  if new.support_reply_id is not null then
    return new;
  end if;

  select r.id
  into v_report_id
  from public.community_feedback_reports r
  where r.community_post_id = new.post_id
  limit 1;

  if v_report_id is null then
    return new;
  end if;

  insert into public.community_feedback_replies (
    report_id,
    created_by,
    body,
    media,
    community_comment_id
  ) values (
    v_report_id,
    new.author_id,
    new.body,
    new.media,
    new.id
  )
  returning id into v_reply_id;

  update public.community_post_comments
  set support_reply_id = v_reply_id
  where id = new.id;

  return new;
end;
$fn$;
