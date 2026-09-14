-- Minute-level waits (1 min = 0.0167 hours) need more than numeric(10, 2).
alter table public.linkedin_campaign_steps
  alter column wait_hours type numeric(12, 4);
