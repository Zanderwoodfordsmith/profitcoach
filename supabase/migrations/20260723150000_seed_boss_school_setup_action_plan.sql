-- Seed default "BOSS School platform setup" action plan for admins to push to coaches.

do $$
declare
  tpl_id uuid;
  ord int := 0;
begin
  select id into tpl_id
  from public.action_plan_templates
  where title = 'BOSS School platform setup'
  limit 1;

  if tpl_id is not null then
    return;
  end if;

  insert into public.action_plan_templates (title, description)
  values (
    'BOSS School platform setup',
    'Configure your profile, funnel, and CRM, score yourself on Compass, then run test assessments before going live with real prospects.'
  )
  returning id into tpl_id;

  insert into public.action_plan_template_items (
    template_id, text, depth, sort_order, estimate, auto_complete_rule
  ) values
    (tpl_id, 'Profile & identity', 0, ord, '', null);
  ord := ord + 1;

  insert into public.action_plan_template_items (
    template_id, text, depth, sort_order, estimate, auto_complete_rule
  ) values
    (tpl_id, 'Review your profile — name, business name, bio, and location — and update anything you''re not happy with', 1, ord, '15m', null),
    (tpl_id, 'Upload a profile avatar (Account → Profile)', 1, ord + 1, '10m', null),
    (tpl_id, 'Add your LinkedIn URL if you want it on your directory listing', 1, ord + 2, '5m', null);
  ord := ord + 3;

  insert into public.action_plan_template_items (
    template_id, text, depth, sort_order, estimate, auto_complete_rule
  ) values
    (tpl_id, 'Funnel & CRM setup', 0, ord, '', null);
  ord := ord + 1;

  insert into public.action_plan_template_items (
    template_id, text, depth, sort_order, estimate, auto_complete_rule
  ) values
    (tpl_id, 'Confirm CRM is linked — your team sets the location ID; check Account → Funnel shows CRM configured', 1, ord, '5m', '{"rule":"crm_configured"}'::jsonb),
    (tpl_id, 'Add your calendar embed code (Account → Funnel)', 1, ord + 1, '15m', '{"rule":"calendar_embed_set"}'::jsonb),
    (tpl_id, 'Add your lead webhook URL so prospects sync to GHL (Account → Funnel)', 1, ord + 2, '15m', '{"rule":"lead_webhook_set"}'::jsonb),
    (tpl_id, 'Choose your default landing page variant (Account → Funnel)', 1, ord + 3, '5m', null),
    (tpl_id, 'Customise your hero eyebrow text if you use landing variant B', 1, ord + 4, '10m', null),
    (tpl_id, 'Copy your personalised assessment link (Account → Funnel) and save it somewhere handy', 1, ord + 5, '5m', null),
    (tpl_id, 'Open your assessment link in an incognito window and click through the landing page', 1, ord + 6, '10m', null);
  ord := ord + 7;

  insert into public.action_plan_template_items (
    template_id, text, depth, sort_order, estimate, auto_complete_rule
  ) values
    (tpl_id, 'Compass & ladder', 0, ord, '', null);
  ord := ord + 1;

  insert into public.action_plan_template_items (
    template_id, text, depth, sort_order, estimate, auto_complete_rule
  ) values
    (tpl_id, 'Score yourself on My Compass — all 12 modules (Compass → My Compass)', 1, ord, '30m', null),
    (tpl_id, 'Set your ladder level and income goal (Compass → My Ladder)', 1, ord + 1, '10m', null);
  ord := ord + 2;

  insert into public.action_plan_template_items (
    template_id, text, depth, sort_order, estimate, auto_complete_rule
  ) values
    (tpl_id, 'Test your funnel end-to-end', 0, ord, '', null);
  ord := ord + 1;

  insert into public.action_plan_template_items (
    template_id, text, depth, sort_order, estimate, auto_complete_rule
  ) values
    (tpl_id, 'Test lead capture only — opt in with a test email without finishing the assessment; confirm the contact lands in GHL', 1, ord, '15m', null),
    (tpl_id, 'Start a test assessment and abandon it partway — confirm you receive the abandoned follow-up email and it looks right', 1, ord + 1, '15m', null),
    (tpl_id, 'Complete a full test assessment — confirm completion email, results page, and your avatar/name look correct', 1, ord + 2, '20m', null),
    (tpl_id, 'Confirm your booking calendar appears on the assessment results page', 1, ord + 3, '5m', null),
    (tpl_id, 'Test your direct assessment URL (/score/your-slug) — the link that skips the landing page', 1, ord + 4, '10m', null),
    (tpl_id, 'Optional: test each landing variant (?variant=a, b, c, d) and pick the one you will share', 1, ord + 5, '20m', null),
    (tpl_id, 'Optional: opt into the coach directory if you want to be listed publicly', 1, ord + 6, '5m', null);
end $$;
