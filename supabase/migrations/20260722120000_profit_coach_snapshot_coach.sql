-- Profit Coach GHL snapshot test coach: webhook, calendar, location for /score testing.
-- Prerequisite: auth user profit-coach-snapshot@businesscoachacademy.com (create via Admin first).

do $$
declare
  snapshot_user_id uuid;
  snapshot_calendar_embed text := '<iframe src="https://link.procoachplatform.com/widget/booking/8jyZoTDwjgn8kTDZlv7y" style="width: 100%;border:none;overflow: hidden;" scrolling="no" id="8jyZoTDwjgn8kTDZlv7y_1779350600944"></iframe><br><script src="https://link.procoachplatform.com/js/form_embed.js" type="text/javascript"></script>';
  snapshot_webhook_url text := 'https://services.leadconnectorhq.com/hooks/nkMdG4ieburQlR9ypQYd/webhook-trigger/UtLyJ7v3Vph4rBhSztbH';
  snapshot_location_id text := 'nkMdG4ieburQlR9ypQYd';
  snapshot_calendar_id text := '8jyZoTDwjgn8kTDZlv7y';
begin
  select u.id
  into snapshot_user_id
  from auth.users u
  where lower(u.email) = 'profit-coach-snapshot@businesscoachacademy.com'
  limit 1;

  if snapshot_user_id is null then
    raise notice 'profit_coach_snapshot_coach: no auth user profit-coach-snapshot@businesscoachacademy.com — skipped.';
    return;
  end if;

  insert into public.profiles (id, role, full_name, coach_business_name)
  values (snapshot_user_id, 'coach', 'Profit Coach Snapshot', 'Profit Coach Snapshot')
  on conflict (id) do update
  set
    full_name = coalesce(nullif(btrim(public.profiles.full_name), ''), excluded.full_name),
    coach_business_name = coalesce(
      nullif(btrim(public.profiles.coach_business_name), ''),
      excluded.coach_business_name
    );

  insert into public.coaches (
    id,
    slug,
    record_kind,
    calendar_embed_code,
    lead_webhook_url,
    crm_location_id,
    ghl_calendar_id
  )
  values (
    snapshot_user_id,
    'profit-coach-snapshot',
    'member',
    snapshot_calendar_embed,
    snapshot_webhook_url,
    snapshot_location_id,
    snapshot_calendar_id
  )
  on conflict (id) do update
  set
    calendar_embed_code = excluded.calendar_embed_code,
    lead_webhook_url = excluded.lead_webhook_url,
    crm_location_id = excluded.crm_location_id,
    ghl_calendar_id = excluded.ghl_calendar_id,
    record_kind = coalesce(public.coaches.record_kind, excluded.record_kind);

  update public.coaches c
  set slug = 'profit-coach-snapshot'
  where c.id = snapshot_user_id
    and c.slug is distinct from 'profit-coach-snapshot'
    and not exists (
      select 1
      from public.coaches other
      where other.slug = 'profit-coach-snapshot'
        and other.id <> snapshot_user_id
    );
end $$;
