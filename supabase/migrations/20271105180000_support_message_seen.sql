-- Support chats: a "Seen" tick on a message (5 Nov), so the other side can
-- say "got it" without writing a reply. A chat waits on whoever has the last
-- word until they reply or tick it. One tick per message, by the other side:
-- the coach ticks BCA's messages, BCA ticks the coach's. A chat's first
-- message lives on the report itself, so it gets its own pair. Additive only.

alter table public.community_feedback_replies
  add column if not exists seen_at timestamptz,
  add column if not exists seen_by uuid references public.profiles(id) on delete set null;

alter table public.community_feedback_reports
  add column if not exists opening_seen_at timestamptz,
  add column if not exists opening_seen_by uuid references public.profiles(id) on delete set null;

-- Tick or untick one message. p_reply_id null = the chat's first message.
-- The coach who owns the chat ticks as themselves; an admin ticks as
-- themselves, or as the coach they are viewing as (p_seen_by), as chats
-- already allow for sending.
create or replace function public.set_support_message_seen(
  p_report_id uuid,
  p_reply_id uuid,
  p_seen boolean,
  p_seen_by uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  is_admin boolean;
  who uuid;
begin
  select exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ) into is_admin;

  if not is_admin and not exists (
    select 1 from public.community_feedback_reports r
    where r.id = p_report_id and r.created_by = auth.uid()
  ) then
    raise exception 'Chat not found';
  end if;

  who := case when is_admin then coalesce(p_seen_by, auth.uid()) else auth.uid() end;

  if p_reply_id is null then
    update public.community_feedback_reports
    set opening_seen_at = case when p_seen then now() else null end,
        opening_seen_by = case when p_seen then who else null end
    where id = p_report_id;
  else
    update public.community_feedback_replies
    set seen_at = case when p_seen then now() else null end,
        seen_by = case when p_seen then who else null end
    where id = p_reply_id and report_id = p_report_id;
  end if;

  if not found then
    raise exception 'Message not found';
  end if;
end;
$fn$;

revoke all on function public.set_support_message_seen(uuid, uuid, boolean, uuid) from public;
grant execute on function public.set_support_message_seen(uuid, uuid, boolean, uuid) to authenticated;
