-- Backfill contacts.phone from GHL appointment data where the contact was created
-- at email capture but phone was never persisted (assessment race / legacy flow).

update public.contacts c
set phone = sub.prospect_phone
from (
  select distinct on (contact_id)
    contact_id,
    trim(prospect_phone) as prospect_phone
  from public.ghl_appointments
  where contact_id is not null
    and prospect_phone is not null
    and trim(prospect_phone) <> ''
  order by contact_id, updated_at desc nulls last
) sub
where c.id = sub.contact_id
  and (c.phone is null or trim(c.phone) = '');

update public.contacts c
set phone = sub.prospect_phone
from (
  select distinct on (coach_id, lower(trim(prospect_email)))
    coach_id,
    lower(trim(prospect_email)) as email_norm,
    trim(prospect_phone) as prospect_phone
  from public.ghl_appointments
  where prospect_email is not null
    and prospect_phone is not null
    and trim(prospect_phone) <> ''
  order by coach_id, lower(trim(prospect_email)), updated_at desc nulls last
) sub
where c.coach_id = sub.coach_id
  and lower(trim(c.email)) = sub.email_norm
  and (c.phone is null or trim(c.phone) = '');
