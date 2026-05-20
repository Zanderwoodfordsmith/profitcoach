-- Primary marketing coach (Pam): ensure coaches row + slug for /score and BOSS Scorecard funnel.
-- Pam keeps her admin profile; this adds the coach profile used for assessments and landing links.

do $$
declare
  pam_user_id uuid;
  pam_calendar_embed text := '<iframe src="https://link.procoachplatform.com/widget/booking/YBxvoiQH6HcHjHYrOWkU" style="width: 100%;border:none;overflow: hidden;" scrolling="no" id="8gGuCLQODMv5nY2iZQB9_1779293123369"></iframe><br><script src="https://link.procoachplatform.com/js/form_embed.js" type="text/javascript"></script>';
begin
  select u.id
  into pam_user_id
  from auth.users u
  where lower(u.email) = 'pam@businesscoachacademy.com'
  limit 1;

  if pam_user_id is null then
    raise notice 'pam_primary_coach_profile: no auth user pam@businesscoachacademy.com — skipped.';
    return;
  end if;

  insert into public.profiles (id, role, full_name, coach_business_name)
  values (pam_user_id, 'admin', 'Pam', 'Business Coach Academy')
  on conflict (id) do update
  set
    coach_business_name = coalesce(
      nullif(btrim(public.profiles.coach_business_name), ''),
      excluded.coach_business_name
    ),
    full_name = coalesce(nullif(btrim(public.profiles.full_name), ''), excluded.full_name);

  insert into public.coaches (id, slug, record_kind, calendar_embed_code)
  values (pam_user_id, 'pam', 'member', pam_calendar_embed)
  on conflict (id) do update
  set
    calendar_embed_code = coalesce(
      nullif(btrim(public.coaches.calendar_embed_code), ''),
      excluded.calendar_embed_code
    ),
    record_kind = coalesce(public.coaches.record_kind, excluded.record_kind);

  -- Set slug to pam when free (required for /assessment/pam and PRIMARY_COACH_SLUG fallback).
  update public.coaches c
  set slug = 'pam'
  where c.id = pam_user_id
    and c.slug is distinct from 'pam'
    and not exists (
      select 1
      from public.coaches other
      where other.slug = 'pam'
        and other.id <> pam_user_id
    );
end $$;
