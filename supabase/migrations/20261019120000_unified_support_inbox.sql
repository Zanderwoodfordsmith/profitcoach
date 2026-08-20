-- Unified Support inbox: sources, assignment, lesson↔ticket link, bidirectional reply sync.

-- Zander Woodford-Smith (default assignee)
-- 01df174c-646c-4a29-8e76-9d0132735434

alter table public.community_feedback_reports
  add column if not exists source text,
  add column if not exists assigned_to uuid references public.profiles(id) on delete set null,
  add column if not exists community_post_id uuid references public.community_posts(id) on delete set null,
  add column if not exists created_by_admin uuid references public.profiles(id) on delete set null,
  add column if not exists submitter_name text;

alter table public.community_feedback_reports
  alter column created_by drop not null;

-- Migrate legacy ticket types → question / bug / idea
alter table public.community_feedback_reports
  drop constraint if exists community_feedback_reports_type_check;

update public.community_feedback_reports
set type = 'idea'
where type = 'feature';

update public.community_feedback_reports
set type = 'question'
where type = 'general';

alter table public.community_feedback_reports
  add constraint community_feedback_reports_type_check
  check (type in ('question', 'bug', 'idea'));

alter table public.community_feedback_reports
  drop constraint if exists community_feedback_reports_source_check;

alter table public.community_feedback_reports
  add constraint community_feedback_reports_source_check
  check (
    source is null
    or source in ('direct', 'lesson_private', 'public_form', 'admin_created')
  );

update public.community_feedback_reports
set source = 'direct'
where source is null;

alter table public.community_feedback_reports
  alter column source set default 'direct';

alter table public.community_feedback_reports
  alter column source set not null;

update public.community_feedback_reports
set assigned_to = '01df174c-646c-4a29-8e76-9d0132735434'::uuid
where assigned_to is null;

alter table public.community_feedback_reports
  alter column assigned_to set default '01df174c-646c-4a29-8e76-9d0132735434'::uuid;

create unique index if not exists community_feedback_reports_community_post_id_uidx
  on public.community_feedback_reports (community_post_id)
  where community_post_id is not null;

create index if not exists community_feedback_reports_assigned_to_idx
  on public.community_feedback_reports (assigned_to, status, created_at desc);

create index if not exists community_feedback_reports_source_idx
  on public.community_feedback_reports (source, created_at desc);

-- Link replies ↔ lesson comments (bidirectional sync)
alter table public.community_feedback_replies
  add column if not exists community_comment_id uuid references public.community_post_comments(id) on delete set null;

alter table public.community_post_comments
  add column if not exists support_reply_id uuid references public.community_feedback_replies(id) on delete set null;

create unique index if not exists community_feedback_replies_community_comment_id_uidx
  on public.community_feedback_replies (community_comment_id)
  where community_comment_id is not null;

create unique index if not exists community_post_comments_support_reply_id_uidx
  on public.community_post_comments (support_reply_id)
  where support_reply_id is not null;

-- Admins may create tickets on behalf of coaches
drop policy if exists "Staff insert own community feedback reports"
  on public.community_feedback_reports;

create policy "Staff insert own community feedback reports"
  on public.community_feedback_reports for insert
  to authenticated
  with check (
    (
      public.is_staff_community()
      and created_by = auth.uid()
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

-- Auto-ticket for private lesson Ask & Share posts
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
      'new'
    );
  end if;
  return new;
end;
$fn$;

drop trigger if exists community_posts_private_lesson_support_ticket_trg
  on public.community_posts;

create trigger community_posts_private_lesson_support_ticket_trg
after insert on public.community_posts
for each row
execute function public.create_support_ticket_from_private_lesson_post();

-- Backfill tickets for existing private lesson posts
insert into public.community_feedback_reports (
  created_by,
  type,
  title,
  details,
  page_path,
  source,
  assigned_to,
  community_post_id,
  status,
  created_at
)
select
  p.author_id,
  'question',
  p.title,
  p.body,
  p.lesson_path,
  'lesson_private',
  '01df174c-646c-4a29-8e76-9d0132735434'::uuid,
  p.id,
  'new',
  p.created_at
from public.community_posts p
where p.post_scope = 'lesson_qa'
  and p.visibility = 'private'
  and not exists (
    select 1
    from public.community_feedback_reports r
    where r.community_post_id = p.id
  );

-- Support reply → lesson comment
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
    support_reply_id
  ) values (
    v_post_id,
    new.created_by,
    new.body,
    new.id
  )
  returning id into v_comment_id;

  update public.community_feedback_replies
  set community_comment_id = v_comment_id
  where id = new.id;

  return new;
end;
$fn$;

drop trigger if exists community_feedback_replies_sync_to_comment_trg
  on public.community_feedback_replies;

create trigger community_feedback_replies_sync_to_comment_trg
after insert on public.community_feedback_replies
for each row
execute function public.sync_support_reply_to_lesson_comment();

-- Lesson comment → support reply
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
    community_comment_id
  ) values (
    v_report_id,
    new.author_id,
    new.body,
    new.id
  )
  returning id into v_reply_id;

  update public.community_post_comments
  set support_reply_id = v_reply_id
  where id = new.id;

  return new;
end;
$fn$;

drop trigger if exists community_post_comments_sync_to_support_trg
  on public.community_post_comments;

create trigger community_post_comments_sync_to_support_trg
after insert on public.community_post_comments
for each row
execute function public.sync_lesson_comment_to_support_reply();
