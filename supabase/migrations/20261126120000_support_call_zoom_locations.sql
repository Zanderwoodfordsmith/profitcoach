-- Support calendars: shared Zoom via branded theprofitcoach.com/zoom-* redirects
-- (not raw Zoom URLs; not Google Meet).

update public.coach_calendars cc
set
  location_mode = 'custom',
  location_custom = case c.slug
    when 'zander' then 'https://theprofitcoach.com/zoom-zander'
    when 'pam' then 'https://theprofitcoach.com/zoom-pam'
  end,
  location_phone = null,
  updated_at = now()
from public.coaches c
where cc.coach_id = c.id
  and c.slug in ('zander', 'pam')
  and cc.slug = 'support';
