-- Support chats: the "Seen" tick becomes a reaction (19 Nov). One tap is 👍,
-- with ❤️ 🙏 😂 ✅ 🔥 💪 behind it. A reaction still means "got it, no reply needed",
-- so it keeps using seen_at / seen_by; this only adds which emoji it was.
-- Old ticks have no emoji and show as 👍. A coach's own WhatsApp reaction can
-- be any emoji, so the column takes any short text. Additive only.

alter table public.community_feedback_replies
  add column if not exists seen_reaction text;

alter table public.community_feedback_reports
  add column if not exists opening_seen_reaction text;

-- Same function, plus which emoji. Dropped and made again so there is only
-- one version: calls without p_reaction (the live app) still work and get 👍.
drop function if exists public.set_support_message_seen(uuid, uuid, boolean, uuid);

create or replace function public.set_support_message_seen(
  p_report_id uuid,
  p_reply_id uuid,
  p_seen boolean,
  p_seen_by uuid default null,
  p_reaction text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  is_admin boolean;
  who uuid;
  emoji text;
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
  emoji := case when p_seen then left(coalesce(nullif(btrim(p_reaction), ''), '👍'), 16) else null end;

  if p_reply_id is null then
    update public.community_feedback_reports
    set opening_seen_at = case when p_seen then now() else null end,
        opening_seen_by = case when p_seen then who else null end,
        opening_seen_reaction = emoji
    where id = p_report_id;
  else
    update public.community_feedback_replies
    set seen_at = case when p_seen then now() else null end,
        seen_by = case when p_seen then who else null end,
        seen_reaction = emoji
    where id = p_reply_id and report_id = p_report_id;
  end if;

  if not found then
    raise exception 'Message not found';
  end if;
end;
$fn$;

revoke all on function public.set_support_message_seen(uuid, uuid, boolean, uuid, text) from public;
grant execute on function public.set_support_message_seen(uuid, uuid, boolean, uuid, text) to authenticated;
