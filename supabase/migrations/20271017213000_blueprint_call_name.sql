-- The call's name is Blueprint Call. Short enough for the step, and it says it is a call.

update public.coach_calendars cc
set
  name = 'Blueprint Call',
  reminder_sequence = replace(cc.reminder_sequence::text, 'Advisory Blueprint', 'Blueprint Call')::jsonb,
  updated_at = now()
from public.coaches c
where cc.coach_id = c.id
  and c.slug = 'pam'
  and cc.slug = 'advisory-blueprint';
