-- Support-call reminders are email only. The Bird SMS sender cannot
-- deliver to UK numbers, so a text flag on these calendars was a failed send.

update public.coach_calendars c
set
  reminder_sequence = (
    select coalesce(
      jsonb_agg(
        jsonb_set(t.elem, '{sms}', 'false'::jsonb)
        order by t.ord
      ),
      '[]'::jsonb
    )
    from jsonb_array_elements(c.reminder_sequence)
      with ordinality as t(elem, ord)
  ),
  updated_at = now()
where c.slug = 'support'
  and jsonb_typeof(c.reminder_sequence) = 'array'
  and jsonb_array_length(c.reminder_sequence) > 0;
