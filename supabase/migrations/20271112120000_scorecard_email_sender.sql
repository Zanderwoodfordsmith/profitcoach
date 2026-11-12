-- Who sends a coach's BOSS Score emails (report + follow-ups), job 214, 12 Nov.
-- 'app' = the coach's own email through Profit Coach; 'crm' = their old CRM (lead webhook).
-- Null = not chosen yet: old CRM when a lead webhook is set, otherwise the app.

alter table public.coaches
  add column if not exists scorecard_email_sender text;

alter table public.coaches
  drop constraint if exists coaches_scorecard_email_sender_check;

alter table public.coaches
  add constraint coaches_scorecard_email_sender_check
  check (scorecard_email_sender is null or scorecard_email_sender in ('app', 'crm'));

comment on column public.coaches.scorecard_email_sender is
  'Who sends BOSS Score report and follow-up emails: app (coach email via Profit Coach) or crm (old CRM). Null = crm when lead_webhook_url is set, else app.';

-- The report page books into the "discovery" calendar. Its default name is now
-- Constraint Call, the same name the emails use. Calendars a coach renamed stay as they are.
update public.coach_calendars
set name = 'Constraint Call'
where slug = 'discovery'
  and name = 'Discovery call';
