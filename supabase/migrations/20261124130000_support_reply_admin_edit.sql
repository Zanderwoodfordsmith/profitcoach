-- Admins can edit support replies; track edits; keep lesson Q&A in sync.

alter table public.community_feedback_replies
  add column if not exists edited_at timestamptz;

comment on column public.community_feedback_replies.edited_at is
  'Set when an admin edits the reply body; null means never edited.';

drop policy if exists "Admins update feedback replies"
  on public.community_feedback_replies;
create policy "Admins update feedback replies"
  on public.community_feedback_replies for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

create or replace function public.touch_support_reply_edited_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.body is distinct from old.body then
    new.edited_at := now();
  end if;
  return new;
end;
$fn$;

drop trigger if exists community_feedback_replies_touch_edited_at_trg
  on public.community_feedback_replies;
create trigger community_feedback_replies_touch_edited_at_trg
before update of body on public.community_feedback_replies
for each row
execute function public.touch_support_reply_edited_at();

-- Keep linked private-lesson comments aligned when support replies change.
create or replace function public.sync_support_reply_update_to_lesson_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.community_comment_id is null then
    return new;
  end if;

  if new.body is not distinct from old.body
     and new.media is not distinct from old.media then
    return new;
  end if;

  update public.community_post_comments
  set
    body = new.body,
    media = new.media
  where id = new.community_comment_id;

  return new;
end;
$fn$;

drop trigger if exists community_feedback_replies_sync_update_to_comment_trg
  on public.community_feedback_replies;
create trigger community_feedback_replies_sync_update_to_comment_trg
after update of body, media on public.community_feedback_replies
for each row
execute function public.sync_support_reply_update_to_lesson_comment();

-- Deleting a support reply also removes its linked lesson comment (if any).
create or replace function public.delete_linked_lesson_comment_for_support_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if old.community_comment_id is not null then
    delete from public.community_post_comments
    where id = old.community_comment_id;
  end if;
  return old;
end;
$fn$;

drop trigger if exists community_feedback_replies_delete_linked_comment_trg
  on public.community_feedback_replies;
create trigger community_feedback_replies_delete_linked_comment_trg
before delete on public.community_feedback_replies
for each row
execute function public.delete_linked_lesson_comment_for_support_reply();
