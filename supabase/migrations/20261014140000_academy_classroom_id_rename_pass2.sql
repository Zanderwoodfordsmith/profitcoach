-- Academy id rename pass 2: remaining win-clients + certification + orphan content.
-- Complements 20261014130000_academy_classroom_id_rename.sql

create temporary table academy_lesson_id_map (
  old_lesson_id text primary key,
  new_lesson_id text not null
) on commit drop;

insert into academy_lesson_id_map (old_lesson_id, new_lesson_id) values
  ('client-acquisition-boss-assessment-marketing-how-to-use-the-boss-score-assessment', 'get-calls-boss-assessment-marketing-how-to-use-the-boss-score-assessment'),
  ('client-acquisition-client-closing-objections', 'win-clients-client-closing-objections'),
  ('client-acquisition-faq-how-to-add-more-prospects-to-a-connector-campaign', 'get-calls-faq-how-to-add-more-prospects-to-a-connector-campaign'),
  ('client-acquisition-faq-how-to-remove-connections-from-a-campaign', 'get-calls-faq-how-to-remove-connections-from-a-campaign'),
  ('client-acquisition-get-calls-overview', 'get-calls-overview'),
  ('client-acquisition-getting-paid-clients-using-value-sessions-how-do-value-sessions-get-you-clients', 'win-clients-getting-paid-clients-using-value-sessions-how-do-value-sessions-get-you-clients'),
  ('client-acquisition-getting-paid-clients-using-value-sessions-how-to-create-cvalue-session-calendar-in-the-crm', 'win-clients-getting-paid-clients-using-value-sessions-how-to-create-cvalue-session-calendar-in-the-crm'),
  ('client-acquisition-getting-paid-clients-using-value-sessions-how-to-deliver-a-value-session', 'win-clients-getting-paid-clients-using-value-sessions-how-to-deliver-a-value-session'),
  ('client-acquisition-getting-paid-clients-using-value-sessions-how-to-sell-on-a-value-session', 'win-clients-getting-paid-clients-using-value-sessions-how-to-sell-on-a-value-session'),
  ('client-acquisition-getting-paid-clients-using-value-sessions-how-value-sessions-improve-your-business', 'win-clients-getting-paid-clients-using-value-sessions-how-value-sessions-improve-your-business'),
  ('client-acquisition-getting-paid-clients-using-value-sessions-messages-to-book-value-session', 'win-clients-getting-paid-clients-using-value-sessions-messages-to-book-value-session'),
  ('client-acquisition-getting-paid-clients-using-value-sessions-what-is-a-value-session', 'win-clients-getting-paid-clients-using-value-sessions-what-is-a-value-session'),
  ('client-acquisition-lead-generation-ai-automation-connector-campaign-editing-follow-up-message-templates', 'get-calls-lead-generation-ai-automation-connector-campaign-editing-follow-up-message-templates'),
  ('client-acquisition-lead-generation-ai-automation-connector-campaign-overview', 'get-calls-lead-generation-ai-automation-connector-campaign-overview'),
  ('client-acquisition-lead-generation-ai-automation-how-to-create-a-campaign-for-prospects-you-are-already-connected-with', 'get-calls-lead-generation-ai-automation-how-to-create-a-campaign-for-prospects-you-are-already-connected-with'),
  ('client-acquisition-lead-generation-ai-automation-how-to-create-campaigns-in-connect-ai', 'get-calls-lead-generation-ai-automation-how-to-create-campaigns-in-connect-ai'),
  ('client-acquisition-lead-generation-ai-automation-how-to-export-a-sales-nav-list-to-csv', 'get-calls-lead-generation-ai-automation-how-to-export-a-sales-nav-list-to-csv'),
  ('client-acquisition-lead-generation-ai-automation-how-to-remove-undesired-profiles-blocklist-people', 'get-calls-lead-generation-ai-automation-how-to-remove-undesired-profiles-blocklist-people'),
  ('client-acquisition-lead-generation-ai-automation-targeted-open-inmail-craft-open-inmail-message', 'get-calls-lead-generation-ai-automation-targeted-open-inmail-craft-open-inmail-message'),
  ('client-acquisition-lead-generation-ai-automation-what-is-connector-how-to-register-for-connector-ai', 'get-calls-lead-generation-ai-automation-what-is-connector-how-to-register-for-connector-ai'),
  ('client-acquisition-lead-generation-ai-automation-write-a-linkedin-connection-message', 'get-calls-lead-generation-ai-automation-write-a-linkedin-connection-message'),
  ('client-acquisition-offer-sales-foundations', 'win-clients-offer-sales-foundations'),
  ('client-acquisition-replying-to-leads-choosing-between-ai-co-pilot-auto-pilot', 'get-calls-replying-to-leads-choosing-between-ai-co-pilot-auto-pilot'),
  ('client-acquisition-replying-to-leads-how-to-activate-the-ai-and-test', 'get-calls-replying-to-leads-how-to-activate-the-ai-and-test'),
  ('client-acquisition-replying-to-leads-how-to-set-up-connector-ai-co-pilot', 'get-calls-replying-to-leads-how-to-set-up-connector-ai-co-pilot'),
  ('client-acquisition-sales-pitch-how-to-share-slides-on-a-sales-call-so-they-don-t-see-your-script', 'win-clients-sales-pitch-how-to-share-slides-on-a-sales-call-so-they-don-t-see-your-script'),
  ('client-acquisition-sales-pitch-post-pitch-process', 'win-clients-sales-pitch-post-pitch-process'),
  ('client-acquisition-sales-pitch-price-pitch', 'win-clients-sales-pitch-price-pitch'),
  ('client-acquisition-sales-pitch-sales-call-asking-questions-in-the-pitch', 'win-clients-sales-pitch-sales-call-asking-questions-in-the-pitch'),
  ('client-acquisition-sales-pitch-sales-call-pitching-principles', 'win-clients-sales-pitch-sales-call-pitching-principles'),
  ('client-acquisition-sales-pitch-sales-call-post-pitch-checking-for-questions', 'win-clients-sales-pitch-sales-call-post-pitch-checking-for-questions'),
  ('client-acquisition-sales-pitch-sales-call-post-pitch-framework-for-answering-questions', 'win-clients-sales-pitch-sales-call-post-pitch-framework-for-answering-questions'),
  ('client-acquisition-sales-pitch-sales-call-the-pitch', 'win-clients-sales-pitch-sales-call-the-pitch'),
  ('client-acquisition-sales-pitch-sales-call-transition-into-pitch', 'win-clients-sales-pitch-sales-call-transition-into-pitch'),
  ('client-acquisition-sales-pitch-sales-pitch-demo-perfecting-your-pitch-performance', 'win-clients-sales-pitch-sales-pitch-demo-perfecting-your-pitch-performance'),
  ('client-acquisition-sales-pitch-sales-pitch-overview', 'win-clients-sales-pitch-sales-pitch-overview'),
  ('client-acquisition-sales-pitch-sales-process-questions-when-should-you-discuss-price', 'win-clients-sales-pitch-sales-process-questions-when-should-you-discuss-price'),
  ('client-acquisition-step-1-choose-understand-ideal-clients', 'get-calls-step-1-choose-understand-ideal-clients'),
  ('client-acquisition-step-2-build-prospect-list', 'get-calls-step-2-build-prospect-list'),
  ('client-acquisition-step-4-top-100-conversations', 'get-calls-step-4-top-100-conversations'),
  ('client-acquisition-step-5-value-sessions', 'win-clients-step-5-value-sessions'),
  ('client-acquisition-step-6-sales-calls', 'win-clients-step-6-sales-calls'),
  ('client-acquisition-value-sessions', 'win-clients-value-sessions'),
  ('client-acquisition-win-clients-overview', 'win-clients-overview'),
  ('client-delivery-client-onboarding', 'coach-clients-onboarding'),
  ('client-retention', 'coach-clients-retention'),
  ('kickstart-welcome-getting-started', 'start-here-getting-started'),
  ('profit-coach-certification-becoming-a-world-class-business-coach', 'coach-clients-certification-becoming-a-world-class-business-coach'),
  ('profit-coach-certification-becoming-a-world-class-business-coach-business-blueprint', 'coach-clients-certification-becoming-a-world-class-business-coach-business-blueprint'),
  ('profit-coach-certification-becoming-a-world-class-business-coach-business-coach-certification-assessment', 'coach-clients-certification-becoming-a-world-class-business-coach-business-coach-certification-assessment'),
  ('profit-coach-certification-becoming-a-world-class-business-coach-certificaiton-round-up-next-steps', 'coach-clients-certification-becoming-a-world-class-business-coach-certificaiton-round-up-next-steps'),
  ('profit-coach-certification-becoming-a-world-class-business-coach-certification-feedback-survey', 'coach-clients-certification-becoming-a-world-class-business-coach-certification-feedback-survey'),
  ('profit-coach-certification-becoming-a-world-class-business-coach-client-sessions-using-tools', 'coach-clients-certification-becoming-a-world-class-business-coach-client-sessions-using-tools'),
  ('profit-coach-certification-becoming-a-world-class-business-coach-coaching-as-a-leader', 'coach-clients-certification-becoming-a-world-class-business-coach-coaching-as-a-leader'),
  ('profit-coach-certification-becoming-a-world-class-business-coach-coaching-as-a-leader-quiz', 'coach-clients-certification-becoming-a-world-class-business-coach-coaching-as-a-leader-quiz'),
  ('profit-coach-certification-becoming-a-world-class-business-coach-ethical-dilemas-quiz', 'coach-clients-certification-becoming-a-world-class-business-coach-ethical-dilemas-quiz'),
  ('profit-coach-certification-becoming-a-world-class-business-coach-ethical-dilemmas-and-difficult-situations', 'coach-clients-certification-becoming-a-world-class-business-coach-ethical-dilemmas-and-difficult-situations'),
  ('profit-coach-certification-becoming-a-world-class-business-coach-example-using-tools-coach-method', 'coach-clients-certification-becoming-a-world-class-business-coach-example-using-tools-coach-method'),
  ('profit-coach-certification-becoming-a-world-class-business-coach-master-coach-to-master-selling', 'coach-clients-certification-becoming-a-world-class-business-coach-master-coach-to-master-selling'),
  ('profit-coach-certification-client-simulators', 'coach-clients-certification-simulators'),
  ('profit-coach-certification-coaching-foundations', 'coach-clients-certification-coaching-foundations'),
  ('profit-coach-certification-coaching-foundations-client-simulator-coach-practice', 'coach-clients-certification-coaching-foundations-client-simulator-coach-practice'),
  ('profit-coach-certification-coaching-foundations-coach-foundations-review', 'coach-clients-certification-coaching-foundations-coach-foundations-review'),
  ('profit-coach-certification-coaching-foundations-core-skill-active-listening-demo', 'coach-clients-certification-coaching-foundations-core-skill-active-listening-demo'),
  ('profit-coach-certification-coaching-foundations-how-coach-creates-more-sessions', 'coach-clients-certification-coaching-foundations-how-coach-creates-more-sessions'),
  ('profit-coach-certification-coaching-foundations-ideal-session-structure', 'coach-clients-certification-coaching-foundations-ideal-session-structure'),
  ('profit-coach-certification-coaching-foundations-live-coaching-session-demo', 'coach-clients-certification-coaching-foundations-live-coaching-session-demo'),
  ('profit-coach-certification-coaching-foundations-the-coach-method-overview', 'coach-clients-certification-coaching-foundations-the-coach-method-overview'),
  ('profit-coach-certification-coaching-foundations-the-coaching-cube', 'coach-clients-certification-coaching-foundations-the-coaching-cube'),
  ('profit-coach-certification-coaching-foundations-the-power-of-effective-feedback', 'coach-clients-certification-coaching-foundations-the-power-of-effective-feedback'),
  ('profit-coach-certification-coaching-foundations-the-use-it-or-lose-it-principle', 'coach-clients-certification-coaching-foundations-the-use-it-or-lose-it-principle'),
  ('profit-coach-certification-coaching-foundations-using-the-coach-method', 'coach-clients-certification-coaching-foundations-using-the-coach-method'),
  ('profit-coach-certification-coaching-foundations-week-1-quiz-introduction-and-coach', 'coach-clients-certification-coaching-foundations-week-1-quiz-introduction-and-coach'),
  ('profit-coach-certification-coaching-foundations-what-is-coaching', 'coach-clients-certification-coaching-foundations-what-is-coaching'),
  ('profit-coach-certification-create-lasting-transformation', 'coach-clients-certification-create-lasting-transformation'),
  ('profit-coach-certification-create-lasting-transformation-advanced-coaching-skills-selling', 'coach-clients-certification-create-lasting-transformation-advanced-coaching-skills-selling'),
  ('profit-coach-certification-create-lasting-transformation-coachin-a-person-feedback-review', 'coach-clients-certification-create-lasting-transformation-coachin-a-person-feedback-review'),
  ('profit-coach-certification-create-lasting-transformation-coaching-mindset', 'coach-clients-certification-create-lasting-transformation-coaching-mindset'),
  ('profit-coach-certification-create-lasting-transformation-coaching-mindset-quiz', 'coach-clients-certification-create-lasting-transformation-coaching-mindset-quiz'),
  ('profit-coach-certification-create-lasting-transformation-controlling-your-state-of-mind', 'coach-clients-certification-create-lasting-transformation-controlling-your-state-of-mind'),
  ('profit-coach-certification-create-lasting-transformation-creating-sustainable-transformation', 'coach-clients-certification-create-lasting-transformation-creating-sustainable-transformation'),
  ('profit-coach-certification-create-lasting-transformation-how-psychology-affects-mindset', 'coach-clients-certification-create-lasting-transformation-how-psychology-affects-mindset'),
  ('profit-coach-certification-create-lasting-transformation-how-to-continually-add-value', 'coach-clients-certification-create-lasting-transformation-how-to-continually-add-value'),
  ('profit-coach-certification-create-lasting-transformation-how-to-use-the-coaching-sheet-in-sessions', 'coach-clients-certification-create-lasting-transformation-how-to-use-the-coaching-sheet-in-sessions'),
  ('profit-coach-certification-create-lasting-transformation-pros-cons-coachin-ai-vs-person', 'coach-clients-certification-create-lasting-transformation-pros-cons-coachin-ai-vs-person'),
  ('profit-coach-certification-create-lasting-transformation-sprint-week-3-overview', 'coach-clients-certification-create-lasting-transformation-sprint-week-3-overview'),
  ('profit-coach-certification-create-lasting-transformation-sprint-week-3-review-homework', 'coach-clients-certification-create-lasting-transformation-sprint-week-3-review-homework'),
  ('profit-coach-certification-create-lasting-transformation-use-vocabulary-to-change-perception', 'coach-clients-certification-create-lasting-transformation-use-vocabulary-to-change-perception'),
  ('profit-coach-certification-the-exact-questions-to-ask-clients', 'coach-clients-certification-the-exact-questions-to-ask-clients'),
  ('profit-coach-certification-the-exact-questions-to-ask-clients-becoming-a-great-coach-quiz', 'coach-clients-certification-the-exact-questions-to-ask-clients-becoming-a-great-coach-quiz'),
  ('profit-coach-certification-the-exact-questions-to-ask-clients-client-simullator-profitabilty-issues-management-consultant', 'coach-clients-certification-the-exact-questions-to-ask-clients-client-simullator-profitabilty-issues-management-consultant'),
  ('profit-coach-certification-the-exact-questions-to-ask-clients-communication-skills-assessment', 'coach-clients-certification-the-exact-questions-to-ask-clients-communication-skills-assessment'),
  ('profit-coach-certification-the-exact-questions-to-ask-clients-how-to-ask-powerful-questions-exercises', 'coach-clients-certification-the-exact-questions-to-ask-clients-how-to-ask-powerful-questions-exercises'),
  ('profit-coach-certification-the-exact-questions-to-ask-clients-icf-8-core-competencies', 'coach-clients-certification-the-exact-questions-to-ask-clients-icf-8-core-competencies'),
  ('profit-coach-certification-the-exact-questions-to-ask-clients-powerful-vs-transformational-questions', 'coach-clients-certification-the-exact-questions-to-ask-clients-powerful-vs-transformational-questions'),
  ('profit-coach-certification-the-exact-questions-to-ask-clients-questioning-and-listening-quiz', 'coach-clients-certification-the-exact-questions-to-ask-clients-questioning-and-listening-quiz'),
  ('profit-coach-certification-the-exact-questions-to-ask-clients-superpowers-quiz', 'coach-clients-certification-the-exact-questions-to-ask-clients-superpowers-quiz'),
  ('profit-coach-certification-the-exact-questions-to-ask-clients-the-power-framework-detail', 'coach-clients-certification-the-exact-questions-to-ask-clients-the-power-framework-detail'),
  ('profit-coach-certification-the-exact-questions-to-ask-clients-the-power-framework-overview', 'coach-clients-certification-the-exact-questions-to-ask-clients-the-power-framework-overview'),
  ('profit-coach-certification-the-exact-questions-to-ask-clients-week-2-coach-superpowers-review', 'coach-clients-certification-the-exact-questions-to-ask-clients-week-2-coach-superpowers-review'),
  ('profit-coach-certification-welcome-to-the-profit-coach-certification', 'coach-clients-certification-welcome-to-the-profit-coach-certification'),
  ('profit-coach-certification-welcome-to-the-profit-coach-certification-how-to-maximise-your-certification-experience', 'coach-clients-certification-welcome-to-the-profit-coach-certification-how-to-maximise-your-certification-experience'),
  ('profit-coach-certification-welcome-to-the-profit-coach-certification-meet-your-faculty-our-coaching-philosophy', 'coach-clients-certification-welcome-to-the-profit-coach-certification-meet-your-faculty-our-coaching-philosophy'),
  ('profit-coach-certification-welcome-to-the-profit-coach-certification-profit-coacbh-roi-calculator', 'coach-clients-certification-welcome-to-the-profit-coach-certification-profit-coacbh-roi-calculator'),
  ('profit-coach-certification-welcome-to-the-profit-coach-certification-profit-coach-certification-workbook', 'coach-clients-certification-welcome-to-the-profit-coach-certification-profit-coach-certification-workbook'),
  ('profit-coach-certification-welcome-to-the-profit-coach-certification-welcome-to-your-coaching-transformation', 'coach-clients-certification-welcome-to-the-profit-coach-certification-welcome-to-your-coaching-transformation'),
  ('profit-coach-system-overview', 'coach-clients-overview'),
  ('profit-coach-system-tool-library', 'coach-clients-tool-library');

-- Prefix catch-all for orphan DB rows not listed above (idempotent with map).
insert into academy_lesson_id_map (old_lesson_id, new_lesson_id)
select c.lesson_id,
  case
    when c.lesson_id like 'kickstart-%' then 'start-here-' || substr(c.lesson_id, length('kickstart-') + 1)
    when c.lesson_id like 'client-delivery-%' then 'coach-clients-' || substr(c.lesson_id, length('client-delivery-') + 1)
    when c.lesson_id like 'client-retention-%' then 'coach-clients-retention-' || substr(c.lesson_id, length('client-retention-') + 1)
    when c.lesson_id like 'profit-coach-certification-%' then 'coach-clients-certification-' || substr(c.lesson_id, length('profit-coach-certification-') + 1)
    when c.lesson_id like 'profit-coach-system-%' then 'coach-clients-' || substr(c.lesson_id, length('profit-coach-system-') + 1)
    when c.lesson_id like 'client-acquisition-getting-paid-clients-using-value-sessions-%'
      or c.lesson_id like 'client-acquisition-sales-pitch-%'
      or c.lesson_id like 'client-acquisition-client-closing-%'
      or c.lesson_id like 'client-acquisition-step-5-%'
      or c.lesson_id like 'client-acquisition-step-6-%'
      then 'win-clients-' || substr(c.lesson_id, length('client-acquisition-') + 1)
    when c.lesson_id like 'client-acquisition-%' then 'get-calls-' || substr(c.lesson_id, length('client-acquisition-') + 1)
    else null
  end
from public.academy_lesson_content c
where (
  c.lesson_id like 'kickstart-%'
  or c.lesson_id like 'client-delivery-%'
  or c.lesson_id like 'client-retention-%'
  or c.lesson_id like 'profit-coach-certification-%'
  or c.lesson_id like 'profit-coach-system-%'
  or c.lesson_id like 'client-acquisition-%'
)
and not exists (select 1 from academy_lesson_id_map m where m.old_lesson_id = c.lesson_id)
on conflict do nothing;

insert into academy_lesson_id_map (old_lesson_id, new_lesson_id)
select p.lesson_id,
  case
    when p.lesson_id like 'kickstart-%' then 'start-here-' || substr(p.lesson_id, length('kickstart-') + 1)
    when p.lesson_id like 'client-delivery-%' then 'coach-clients-' || substr(p.lesson_id, length('client-delivery-') + 1)
    when p.lesson_id like 'client-retention-%' then 'coach-clients-retention-' || substr(p.lesson_id, length('client-retention-') + 1)
    when p.lesson_id like 'profit-coach-certification-%' then 'coach-clients-certification-' || substr(p.lesson_id, length('profit-coach-certification-') + 1)
    when p.lesson_id like 'profit-coach-system-%' then 'coach-clients-' || substr(p.lesson_id, length('profit-coach-system-') + 1)
    when p.lesson_id like 'client-acquisition-getting-paid-clients-using-value-sessions-%'
      or p.lesson_id like 'client-acquisition-sales-pitch-%'
      or p.lesson_id like 'client-acquisition-client-closing-%'
      or p.lesson_id like 'client-acquisition-step-5-%'
      or p.lesson_id like 'client-acquisition-step-6-%'
      then 'win-clients-' || substr(p.lesson_id, length('client-acquisition-') + 1)
    when p.lesson_id like 'client-acquisition-%' then 'get-calls-' || substr(p.lesson_id, length('client-acquisition-') + 1)
    else null
  end
from public.academy_lesson_progress p
where (
  p.lesson_id like 'kickstart-%'
  or p.lesson_id like 'client-delivery-%'
  or p.lesson_id like 'client-retention-%'
  or p.lesson_id like 'profit-coach-certification-%'
  or p.lesson_id like 'profit-coach-system-%'
  or p.lesson_id like 'client-acquisition-%'
)
and not exists (select 1 from academy_lesson_id_map m where m.old_lesson_id = p.lesson_id)
on conflict do nothing;

delete from academy_lesson_id_map where new_lesson_id is null or new_lesson_id = old_lesson_id;

create or replace function public.academy_canonical_course_id(
  p_course_id text,
  p_lesson_id text
)
returns text
language sql
immutable
as $$
  select case
    when p_lesson_id like 'profit-coach-os-%' then 'profit-coach-os'
    when p_lesson_id like 'coach-clients-%' then 'coach-clients'
    when p_lesson_id like 'win-clients-%' then 'win-clients'
    when p_lesson_id like 'get-calls-%' then 'get-calls'
    when p_lesson_id like 'start-here-%' then 'start-here'
    when p_lesson_id like 'coach-action-plan-%' then 'coach-action-plan'
    when p_lesson_id like 'going-pro-%' then 'going-pro'
    when p_lesson_id like 'profit-coach-certification-%' then 'coach-clients'
    when p_lesson_id like 'profit-brand-framework-%' then 'profit-brand-framework'
    when p_lesson_id like 'client-acquisition-getting-paid-clients-using-value-sessions-%'
      or p_lesson_id like 'client-acquisition-sales-pitch-%'
      or p_lesson_id like 'client-acquisition-client-closing-%'
      then 'win-clients'
    when p_lesson_id like 'client-acquisition-%' then 'get-calls'
    when p_lesson_id like 'client-delivery-%' then 'coach-clients'
    when p_lesson_id like 'client-retention-%' then 'coach-clients'
    when p_lesson_id like 'kickstart-%' then 'start-here'
    else p_course_id
  end
$$;

update public.academy_lesson_progress t
set lesson_id = m.new_lesson_id
from academy_lesson_id_map m
where t.lesson_id = m.old_lesson_id
  and not exists (
    select 1 from public.academy_lesson_progress x
    where x.user_id = t.user_id and x.course_id = t.course_id and x.lesson_id = m.new_lesson_id
  );

update public.academy_lesson_views t
set lesson_id = m.new_lesson_id
from academy_lesson_id_map m
where t.lesson_id = m.old_lesson_id
  and not exists (
    select 1 from public.academy_lesson_views x
    where x.user_id = t.user_id and x.course_id = t.course_id and x.lesson_id = m.new_lesson_id
  );

update public.academy_lesson_progress_events t
set lesson_id = m.new_lesson_id
from academy_lesson_id_map m
where t.lesson_id = m.old_lesson_id;

insert into public.academy_lesson_content (
  course_id, lesson_id, title, body_markdown, guide_markdown, transcript_text,
  video_url, audio_url, duration, is_draft, is_deleted, recommended_actions, updated_at
)
select
  public.academy_canonical_course_id(c.course_id, coalesce(lm.new_lesson_id, c.lesson_id)),
  coalesce(lm.new_lesson_id, c.lesson_id),
  c.title, c.body_markdown, c.guide_markdown, c.transcript_text,
  c.video_url, c.audio_url, c.duration, c.is_draft, c.is_deleted, c.recommended_actions, c.updated_at
from public.academy_lesson_content c
join academy_lesson_id_map lm on lm.old_lesson_id = c.lesson_id
on conflict (course_id, lesson_id) do update set
  title = excluded.title,
  body_markdown = excluded.body_markdown,
  guide_markdown = excluded.guide_markdown,
  transcript_text = excluded.transcript_text,
  video_url = excluded.video_url,
  audio_url = excluded.audio_url,
  duration = excluded.duration,
  is_draft = excluded.is_draft,
  is_deleted = excluded.is_deleted,
  recommended_actions = excluded.recommended_actions,
  updated_at = excluded.updated_at;

delete from public.academy_lesson_content c
using academy_lesson_id_map lm
where c.lesson_id = lm.old_lesson_id;

update public.academy_lesson_resources t
set lesson_id = m.new_lesson_id
from academy_lesson_id_map m
where t.lesson_id = m.old_lesson_id
  and not exists (
    select 1 from public.academy_lesson_resources x
    where x.course_id = t.course_id
      and x.lesson_id = m.new_lesson_id
      and x.resource_id = t.resource_id
  );

delete from public.academy_lesson_resources t
using academy_lesson_id_map m
where t.lesson_id = m.old_lesson_id;

update public.academy_lesson_resources t
set course_id = public.academy_canonical_course_id(t.course_id, t.lesson_id)
where t.course_id is distinct from public.academy_canonical_course_id(t.course_id, t.lesson_id)
  and not exists (
    select 1 from public.academy_lesson_resources x
    where x.course_id = public.academy_canonical_course_id(t.course_id, t.lesson_id)
      and x.lesson_id = t.lesson_id
      and x.resource_id = t.resource_id
  );

delete from public.academy_lesson_resources t
where t.course_id is distinct from public.academy_canonical_course_id(t.course_id, t.lesson_id);

with ranked as (
  select
    user_id,
    public.academy_canonical_course_id(course_id, lesson_id) as canonical_course_id,
    lesson_id,
    status,
    updated_at,
    row_number() over (
      partition by user_id, public.academy_canonical_course_id(course_id, lesson_id), lesson_id
      order by case status when 'completed' then 0 when 'needs_review' then 1 else 2 end, updated_at desc
    ) as rn
  from public.academy_lesson_progress
)
insert into public.academy_lesson_progress (user_id, course_id, lesson_id, status, updated_at)
select user_id, canonical_course_id, lesson_id, status, updated_at from ranked where rn = 1
on conflict (user_id, course_id, lesson_id) do update set
  status = case
    when public.academy_lesson_progress.status = 'completed' then 'completed'
    when excluded.status = 'completed' then 'completed'
    else excluded.status
  end,
  updated_at = greatest(public.academy_lesson_progress.updated_at, excluded.updated_at);

delete from public.academy_lesson_progress
where course_id is distinct from public.academy_canonical_course_id(course_id, lesson_id);

with ranked as (
  select
    user_id,
    public.academy_canonical_course_id(course_id, lesson_id) as canonical_course_id,
    lesson_id,
    viewed_at,
    row_number() over (
      partition by user_id, public.academy_canonical_course_id(course_id, lesson_id), lesson_id
      order by viewed_at desc
    ) as rn
  from public.academy_lesson_views
)
insert into public.academy_lesson_views (user_id, course_id, lesson_id, viewed_at)
select user_id, canonical_course_id, lesson_id, viewed_at from ranked where rn = 1
on conflict (user_id, course_id, lesson_id) do update set
  viewed_at = greatest(public.academy_lesson_views.viewed_at, excluded.viewed_at);

delete from public.academy_lesson_views
where course_id is distinct from public.academy_canonical_course_id(course_id, lesson_id);

update public.coach_action_items
set academy_lesson_id = m.new_lesson_id
from academy_lesson_id_map m
where academy_lesson_id = m.old_lesson_id;

update public.coach_action_items api
set academy_course_id = public.academy_canonical_course_id(
  coalesce(api.academy_course_id, ''),
  api.academy_lesson_id
)
where api.academy_lesson_id is not null
  and api.academy_course_id is distinct from public.academy_canonical_course_id(
    coalesce(api.academy_course_id, ''),
    api.academy_lesson_id
  );

update public.community_posts p
set lesson_id = m.new_lesson_id
from academy_lesson_id_map m
where p.post_scope = 'lesson_qa'
  and p.lesson_id = m.old_lesson_id;

update public.community_posts p
set lesson_course_id = public.academy_canonical_course_id(
  coalesce(p.lesson_course_id, ''),
  p.lesson_id
)
where p.post_scope = 'lesson_qa'
  and p.lesson_id is not null
  and p.lesson_course_id is distinct from public.academy_canonical_course_id(
    coalesce(p.lesson_course_id, ''),
    p.lesson_id
  );
