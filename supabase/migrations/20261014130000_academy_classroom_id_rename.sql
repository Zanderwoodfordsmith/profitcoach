-- Academy id rename: align storage/URLs with current Classroom product names.
-- Progress/views/content/actions remapped; old URLs redirected in Next.js.

create temporary table academy_lesson_id_map (
  old_lesson_id text primary key,
  new_lesson_id text not null
) on commit drop;

insert into academy_lesson_id_map (old_lesson_id, new_lesson_id) values
  ('kickstart-welcome-welcome-program-overview', 'start-here-welcome-welcome-program-overview'),
  ('kickstart-welcome-member-wins', 'start-here-welcome-member-wins'),
  ('kickstart-welcome-pick-your-path', 'start-here-welcome-pick-your-path'),
  ('kickstart-welcome-introduce-yourself', 'start-here-welcome-introduce-yourself'),
  ('kickstart-welcome-community-tour', 'start-here-welcome-community-tour'),
  ('kickstart-welcome-classroom-tour', 'start-here-welcome-classroom-tour'),
  ('kickstart-welcome-calendar-calls', 'start-here-welcome-calendar-calls'),
  ('kickstart-welcome-support', 'start-here-welcome-support'),
  ('kickstart-welcome-academy-tour', 'start-here-welcome-academy-tour'),
  ('kickstart-welcome-tools-bonuses', 'start-here-welcome-tools-bonuses'),
  ('going-pro-iii-1-day-zero-foreword-to-day-zero-going-pro', 'going-pro-day-zero-foreword-to-day-zero-going-pro'),
  ('going-pro-iii-1-day-zero-pro-energy', 'going-pro-day-zero-pro-energy'),
  ('going-pro-iii-1-day-zero-pro-time-management', 'going-pro-day-zero-pro-time-management'),
  ('going-pro-iii-1-day-zero-pro-focus', 'going-pro-day-zero-pro-focus'),
  ('going-pro-iii-1-day-zero-pro-productivity', 'going-pro-day-zero-pro-productivity'),
  ('going-pro-iii-1-day-zero-pro-mindset', 'going-pro-day-zero-pro-mindset'),
  ('client-acquisition-ideal-clients-how-to-choose-your-core-client', 'get-calls-ideal-clients-how-to-choose-your-core-client'),
  ('client-acquisition-ideal-clients-proactive-prospecting-your-path-to-finding-ideal-clients', 'get-calls-ideal-clients-proactive-prospecting-your-path-to-finding-ideal-clients'),
  ('client-acquisition-ideal-clients-give-them-what-they-want-understanding-your-client-s-day', 'get-calls-ideal-clients-give-them-what-they-want-understanding-your-client-s-day'),
  ('client-acquisition-ideal-clients-the-mentor-exercise', 'get-calls-ideal-clients-the-mentor-exercise'),
  ('client-acquisition-ideal-clients-principles-of-effective-prospect-search-find', 'get-calls-ideal-clients-principles-of-effective-prospect-search-find'),
  ('client-acquisition-ideal-clients-evaluating-prospect-list-kpis', 'get-calls-ideal-clients-evaluating-prospect-list-kpis'),
  ('client-acquisition-ideal-clients-linkedin-sales-navigator-sign-up', 'get-calls-ideal-clients-linkedin-sales-navigator-sign-up'),
  ('client-acquisition-ideal-clients-linkedin-sales-navigator-build-your-base-search', 'get-calls-ideal-clients-linkedin-sales-navigator-build-your-base-search'),
  ('client-acquisition-ideal-clients-linkedin-sales-navigator-build-your-ideal-prospect-list', 'get-calls-ideal-clients-linkedin-sales-navigator-build-your-ideal-prospect-list'),
  ('client-acquisition-ideal-clients-linkedin-sales-navigator-refining-your-ideal-prospect-list-blacklisting', 'get-calls-ideal-clients-linkedin-sales-navigator-refining-your-ideal-prospect-list-blacklisting'),
  ('client-acquisition-ideal-clients-linkedin-sales-navigator-find-more-prospects-with-keyword-search', 'get-calls-ideal-clients-linkedin-sales-navigator-find-more-prospects-with-keyword-search'),
  ('client-acquisition-ideal-clients-finding-ideal-clients-beyond-traditional-methods', 'get-calls-ideal-clients-finding-ideal-clients-beyond-traditional-methods'),
  ('client-acquisition-linkedin-optimization-linkedin-profile-checklist-to-optimise-your-profile', 'get-calls-linkedin-optimization-linkedin-profile-checklist-to-optimise-your-profile'),
  ('client-acquisition-linkedin-optimization-linkedin-profile-setup-a-professional-headshot', 'get-calls-linkedin-optimization-linkedin-profile-setup-a-professional-headshot'),
  ('client-acquisition-linkedin-optimization-linkedin-profile-designing-your-banner', 'get-calls-linkedin-optimization-linkedin-profile-designing-your-banner'),
  ('client-acquisition-linkedin-optimization-linkedin-profile-dfy-write-your-about-section', 'get-calls-linkedin-optimization-linkedin-profile-dfy-write-your-about-section'),
  ('client-acquisition-linkedin-optimization-profit-coach-linkedin-announcement-post', 'get-calls-linkedin-optimization-profit-coach-linkedin-announcement-post'),
  ('client-acquisition-calendar-setup-how-to-simplify-scheduling-meetins-with-prospects', 'get-calls-calendar-setup-how-to-simplify-scheduling-meetins-with-prospects'),
  ('client-acquisition-lead-generation-intro-traffic-the-best-wat-to-get-leads', 'get-calls-lead-generation-intro-traffic-the-best-wat-to-get-leads'),
  ('client-acquisition-lead-generation-intro-lead-generation-workflow', 'get-calls-lead-generation-intro-lead-generation-workflow'),
  ('client-acquisition-lead-generation-intro-testing-is-key-to-lead-generation', 'get-calls-lead-generation-intro-testing-is-key-to-lead-generation'),
  ('client-acquisition-lead-generation-personalised-vip-nurture-top-100-vip-nurture-overview', 'get-calls-lead-generation-personalised-vip-nurture-top-100-vip-nurture-overview'),
  ('client-acquisition-lead-generation-personalised-vip-nurture-top-100-how-to-identify-your-top-100-prospects', 'get-calls-lead-generation-personalised-vip-nurture-top-100-how-to-identify-your-top-100-prospects'),
  ('client-acquisition-lead-generation-personalised-vip-nurture-top-100-how-to-craft-personalized-insightful-messages', 'get-calls-lead-generation-personalised-vip-nurture-top-100-how-to-craft-personalized-insightful-messages'),
  ('client-acquisition-lead-generation-personalised-vip-nurture-top-100-how-to-use-multiple-channels-to-engage', 'get-calls-lead-generation-personalised-vip-nurture-top-100-how-to-use-multiple-channels-to-engage'),
  ('client-acquisition-replying-to-leads-mistakse-to-avoid-when-replying-to-prospects', 'get-calls-replying-to-leads-mistakse-to-avoid-when-replying-to-prospects'),
  ('client-acquisition-client-closing-find-the-real-objection', 'win-clients-client-closing-find-the-real-objection'),
  ('client-acquisition-client-closing-universal-closing-loops', 'win-clients-client-closing-universal-closing-loops'),
  ('client-acquisition-client-closing-time-to-think-objection', 'win-clients-client-closing-time-to-think-objection'),
  ('client-acquisition-client-closing-money-objection', 'win-clients-client-closing-money-objection'),
  ('client-acquisition-client-closing-partner-objection', 'win-clients-client-closing-partner-objection'),
  ('client-acquisition-client-closing-timing-objection', 'win-clients-client-closing-timing-objection'),
  ('client-acquisition-client-closing-fear-objection', 'win-clients-client-closing-fear-objection'),
  ('client-acquisition-client-closing-universal-closes-final-moves', 'win-clients-client-closing-universal-closes-final-moves'),
  ('client-delivery-client-onboarding-how-to-setup-a-new-client', 'coach-clients-client-onboarding-how-to-setup-a-new-client'),
  ('client-delivery-client-onboarding-session-1-profit-systems-dashboard', 'coach-clients-client-onboarding-session-1-profit-systems-dashboard'),
  ('client-delivery-client-onboarding-session-2-leverage-critical-issues', 'coach-clients-client-onboarding-session-2-leverage-critical-issues'),
  ('client-delivery-client-onboarding-session-3-align-3-year-plan', 'coach-clients-client-onboarding-session-3-align-3-year-plan'),
  ('client-delivery-other-coachin-session-content-session-3-align-the-3-year-plan', 'coach-clients-other-coachin-session-content-session-3-align-the-3-year-plan'),
  ('client-delivery-client-onboarding-session-4-ninety-day-plan', 'coach-clients-client-onboarding-session-4-ninety-day-plan'),
  ('client-delivery-coachiing-session-structure-how-to-use-the-coaching-sheet-in-sessions', 'coach-clients-coachiing-session-structure-how-to-use-the-coaching-sheet-in-sessions'),
  ('client-delivery-coaching-session-faqs-coaching-faq-should-i-stick-to-the-coaching-sessions-exactly-in-the-orde', 'coach-clients-coaching-session-faqs-coaching-faq-should-i-stick-to-the-coaching-sessions-exactly-in-the-orde'),
  ('client-delivery-coaching-session-faqs-coaching-faq-how-to-handle-clients-in-crisis', 'coach-clients-coaching-session-faqs-coaching-faq-how-to-handle-clients-in-crisis'),
  ('client-delivery-coaching-session-faqs-coaching-faq-how-to-handle-a-client-with-a-new-priority-that-is-off-plan', 'coach-clients-coaching-session-faqs-coaching-faq-how-to-handle-a-client-with-a-new-priority-that-is-off-plan'),
  ('client-delivery-coaching-session-faqs-coaching-faq-how-do-you-run-a-typical-coaching-session-james-baker', 'coach-clients-coaching-session-faqs-coaching-faq-how-do-you-run-a-typical-coaching-session-james-baker'),
  ('client-delivery-coaching-session-faqs-coaching-faq-how-to-handle-clients-who-don-t-want-to-grow-the-business', 'coach-clients-coaching-session-faqs-coaching-faq-how-to-handle-clients-who-don-t-want-to-grow-the-business'),
  ('client-delivery-coaching-session-faqs-coaching-faq-how-to-handle-clients-giving-false-or-uncertain-answers', 'coach-clients-coaching-session-faqs-coaching-faq-how-to-handle-clients-giving-false-or-uncertain-answers'),
  ('client-delivery-coaching-session-faqs-coaching-faq-how-do-you-end-a-coaching-session-ashley-maile', 'coach-clients-coaching-session-faqs-coaching-faq-how-do-you-end-a-coaching-session-ashley-maile'),
  ('client-delivery-coaching-session-faqs-coaching-faq-how-do-you-handle-clients-who-don-t-do-cashflow-or-other-to', 'coach-clients-coaching-session-faqs-coaching-faq-how-do-you-handle-clients-who-don-t-do-cashflow-or-other-to'),
  ('client-delivery-coaching-session-faqs-coaching-faq-how-to-handle-a-client-with-low-energy-and-commitment', 'coach-clients-coaching-session-faqs-coaching-faq-how-to-handle-a-client-with-low-energy-and-commitment'),
  ('client-delivery-coachiing-session-structure-how-to-start-a-coaching-session', 'coach-clients-coachiing-session-structure-how-to-start-a-coaching-session'),
  ('client-delivery-coachiing-session-structure-how-eo-end-a-coaching-session', 'coach-clients-coachiing-session-structure-how-eo-end-a-coaching-session'),
  ('client-retention-prevent-overwhelm', 'coach-clients-retention-prevent-overwhelm'),
  ('client-retention-remove-distraction', 'coach-clients-retention-remove-distraction'),
  ('client-retention-ownership', 'coach-clients-retention-ownership'),
  ('client-retention-generate-belief', 'coach-clients-retention-generate-belief'),
  ('client-retention-results-and-rewards', 'coach-clients-retention-results-and-rewards'),
  ('client-retention-exemplify', 'coach-clients-retention-exemplify'),
  ('client-retention-sustainability', 'coach-clients-retention-sustainability'),
  ('client-retention-self-identity', 'coach-clients-retention-self-identity'),
  ('profit-coach-certification-client-simulators-client-simulator-coach-practice-1', 'coach-clients-certification-client-simulators-client-simulator-coach-practice-1'),
  ('profit-coach-certification-client-simulators-revenue-optmisation-thai-restaurant', 'coach-clients-certification-client-simulators-revenue-optmisation-thai-restaurant'),
  ('profit-coach-certification-client-simulators-client-simulator-profitability-issues-management-consultant', 'coach-clients-certification-client-simulators-client-simulator-profitability-issues-management-consultant'),
  ('profit-coach-certification-client-simulators-multi-location-operaitons-issues-chiropractor', 'coach-clients-certification-client-simulators-multi-location-operaitons-issues-chiropractor'),
  ('profit-coach-certification-client-simulators-business-pressure-manufacturing-engineering', 'coach-clients-certification-client-simulators-business-pressure-manufacturing-engineering'),
  ('profit-coach-certification-client-simulators-diverse-business-units-legal-saas', 'coach-clients-certification-client-simulators-diverse-business-units-legal-saas'),
  ('profit-coach-certification-client-simulators-business-coach-certificaiton-assessment', 'coach-clients-certification-client-simulators-business-coach-certificaiton-assessment');

create temporary table academy_course_id_map (
  old_course_id text primary key,
  new_course_id text not null
) on commit drop;

insert into academy_course_id_map (old_course_id, new_course_id) values
  ('kickstart', 'start-here'),
  ('client-acquisition', 'get-clients'),
  ('profit-coach-system', 'coach-clients'),
  ('client-delivery', 'coach-clients'),
  ('profit-coach-certification', 'coach-clients'),
  ('client-retention', 'coach-clients');

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
    when p_lesson_id like 'client-acquisition-%' then 'get-calls'
    when p_lesson_id like 'client-delivery-%' then 'coach-clients'
    when p_lesson_id like 'client-retention-%' then 'coach-clients'
    when p_lesson_id like 'kickstart-%' then 'start-here'
    else p_course_id
  end
$$;

-- Remap public.academy_lesson_progress
update public.academy_lesson_progress t
set lesson_id = m.new_lesson_id
from academy_lesson_id_map m
where t.lesson_id = m.old_lesson_id
  and not exists (
    select 1 from public.academy_lesson_progress x
    where x.user_id = t.user_id and x.course_id = t.course_id and x.lesson_id = m.new_lesson_id
  );

-- Remap public.academy_lesson_views
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

-- Remap academy_lesson_content via insert+delete to handle PK changes
insert into public.academy_lesson_content (
  course_id, lesson_id, title, body_markdown, guide_markdown, transcript_text,
  video_url, audio_url, duration, is_draft, is_deleted, recommended_actions, updated_at
)
select
  public.academy_canonical_course_id(coalesce(cm.new_course_id, c.course_id), coalesce(lm.new_lesson_id, c.lesson_id)),
  coalesce(lm.new_lesson_id, c.lesson_id),
  c.title, c.body_markdown, c.guide_markdown, c.transcript_text,
  c.video_url, c.audio_url, c.duration, c.is_draft, c.is_deleted, c.recommended_actions, c.updated_at
from public.academy_lesson_content c
left join academy_lesson_id_map lm on lm.old_lesson_id = c.lesson_id
left join academy_course_id_map cm on cm.old_course_id = c.course_id
where lm.old_lesson_id is not null or cm.old_course_id is not null
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

delete from public.academy_lesson_content c
using academy_course_id_map cm
where c.course_id = cm.old_course_id
  and not exists (select 1 from academy_lesson_id_map lm where lm.new_lesson_id = c.lesson_id);

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

-- Move progress onto canonical course ids for renamed lessons
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

-- Community lesson Q&A deep links
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

