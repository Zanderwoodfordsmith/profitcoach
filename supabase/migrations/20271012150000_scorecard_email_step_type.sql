-- Boss Score follow-ups are emails. A few accounts stored them as LinkedIn
-- messages, so the builder labelled them "LinkedIn message" and the worker
-- would have sent them on LinkedIn. The copy is already packed as email.
update public.linkedin_campaign_steps as s
set step_type = 'email'
from public.linkedin_campaigns as c
where s.campaign_id = c.id
  and c.source_playbook_id in ('scorecard-incomplete', 'scorecard-complete')
  and s.step_type = 'message'
  and coalesce(s.body, '') like 'Subject:%';
