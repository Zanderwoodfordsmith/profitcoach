-- Preserve lesson completion after chapter consolidations.
-- Copies completed ticks from old standalone lesson ids onto chapter progress
-- under the new parent lesson id, then marks the parent completed when every
-- chapter for that consolidation is done. Title renames do not matter — ids do.

create temporary table _consolidation_chapter_map (
  course_id text not null,
  parent_lesson_id text not null,
  legacy_lesson_id text not null,
  chapter_id text not null
) on commit drop;

insert into _consolidation_chapter_map (course_id, parent_lesson_id, legacy_lesson_id, chapter_id)
values
  ('win-clients', 'win-clients-book-and-run-value-sessions', 'win-clients-getting-paid-clients-using-value-sessions-what-is-a-value-session', 'what-is-a-value-session'),
  ('win-clients', 'win-clients-book-and-run-value-sessions', 'win-clients-getting-paid-clients-using-value-sessions-how-do-value-sessions-get-you-clients', 'how-value-sessions-get-clients'),
  ('win-clients', 'win-clients-book-and-run-value-sessions', 'win-clients-getting-paid-clients-using-value-sessions-messages-to-book-value-session', 'messages-to-book'),
  ('win-clients', 'win-clients-book-and-run-value-sessions', 'win-clients-getting-paid-clients-using-value-sessions-how-to-create-cvalue-session-calendar-in-the-crm', 'crm-calendar'),
  ('win-clients', 'win-clients-book-and-run-value-sessions', 'win-clients-getting-paid-clients-using-value-sessions-how-to-deliver-a-value-session', 'how-to-deliver'),
  ('win-clients', 'win-clients-book-and-run-value-sessions', 'win-clients-getting-paid-clients-using-value-sessions-how-value-sessions-improve-your-business', 'improve-your-business'),
  ('win-clients', 'win-clients-book-and-run-value-sessions', 'win-clients-getting-paid-clients-using-value-sessions-how-to-sell-on-a-value-session', 'how-to-sell'),
  ('get-calls', 'get-calls-ideal-clients-linkedin-sales-navigator-build-your-prospect-list', 'get-calls-ideal-clients-linkedin-sales-navigator-sign-up', 'sign-up'),
  ('get-calls', 'get-calls-ideal-clients-linkedin-sales-navigator-build-your-prospect-list', 'get-calls-ideal-clients-linkedin-sales-navigator-build-your-base-search', 'base-search'),
  ('get-calls', 'get-calls-ideal-clients-linkedin-sales-navigator-build-your-prospect-list', 'get-calls-ideal-clients-linkedin-sales-navigator-build-your-ideal-prospect-list', 'prospect-list'),
  ('get-calls', 'get-calls-ideal-clients-linkedin-sales-navigator-build-your-prospect-list', 'get-calls-ideal-clients-linkedin-sales-navigator-refining-your-ideal-prospect-list-blacklisting', 'refining-blacklist'),
  ('get-calls', 'get-calls-ideal-clients-finding-ideal-clients-mindset-and-search', 'get-calls-ideal-clients-proactive-prospecting-your-path-to-finding-ideal-clients', 'proactive-prospecting'),
  ('get-calls', 'get-calls-ideal-clients-finding-ideal-clients-mindset-and-search', 'get-calls-ideal-clients-principles-of-effective-prospect-search-find', 'find-principles'),
  ('get-calls', 'get-calls-ideal-clients-finding-ideal-clients-mindset-and-search', 'get-calls-ideal-clients-evaluating-prospect-list-kpis', 'list-kpis'),
  ('get-calls', 'get-calls-linkedin-optimization-set-up-your-linkedin-profile', 'get-calls-linkedin-optimization-linkedin-profile-checklist-to-optimise-your-profile', 'checklist'),
  ('get-calls', 'get-calls-linkedin-optimization-set-up-your-linkedin-profile', 'get-calls-linkedin-optimization-linkedin-profile-setup-a-professional-headshot', 'headshot'),
  ('get-calls', 'get-calls-linkedin-optimization-set-up-your-linkedin-profile', 'get-calls-linkedin-optimization-linkedin-profile-designing-your-banner', 'banner'),
  ('get-calls', 'get-calls-linkedin-optimization-set-up-your-linkedin-profile', 'get-calls-linkedin-optimization-linkedin-profile-dfy-write-your-about-section', 'about-section'),
  ('get-calls', 'get-calls-linkedin-optimization-set-up-your-linkedin-profile', 'get-calls-linkedin-optimization-profit-coach-linkedin-announcement-post', 'announcement-post'),
  ('get-calls', 'get-calls-ideal-clients-understand-your-ideal-client', 'get-calls-ideal-clients-give-them-what-they-want-understanding-your-client-s-day', 'clients-day'),
  ('get-calls', 'get-calls-ideal-clients-understand-your-ideal-client', 'get-calls-ideal-clients-the-mentor-exercise', 'mentor-exercise'),
  ('get-calls', 'get-calls-lead-generation-lead-gen-foundations', 'get-calls-lead-generation-intro-traffic-the-best-wat-to-get-leads', 'traffic'),
  ('get-calls', 'get-calls-lead-generation-lead-gen-foundations', 'get-calls-lead-generation-intro-lead-generation-workflow', 'workflow'),
  ('get-calls', 'get-calls-lead-generation-lead-gen-foundations', 'get-calls-lead-generation-intro-testing-is-key-to-lead-generation', 'testing'),
  ('get-calls', 'get-calls-lead-generation-run-your-vip-nurture', 'get-calls-lead-generation-personalised-vip-nurture-top-100-vip-nurture-overview', 'overview'),
  ('get-calls', 'get-calls-lead-generation-run-your-vip-nurture', 'get-calls-lead-generation-personalised-vip-nurture-top-100-how-to-identify-your-top-100-prospects', 'top-100'),
  ('get-calls', 'get-calls-lead-generation-run-your-vip-nurture', 'get-calls-lead-generation-personalised-vip-nurture-top-100-how-to-craft-personalized-insightful-messages', 'messages'),
  ('get-calls', 'get-calls-lead-generation-run-your-vip-nurture', 'get-calls-lead-generation-personalised-vip-nurture-top-100-how-to-use-multiple-channels-to-engage', 'channels'),
  ('get-calls', 'get-calls-replying-to-leads-set-up-connector-co-pilot', 'get-calls-replying-to-leads-how-to-set-up-connector-ai-co-pilot', 'setup'),
  ('get-calls', 'get-calls-replying-to-leads-set-up-connector-co-pilot', 'get-calls-replying-to-leads-choosing-between-ai-co-pilot-auto-pilot', 'mode'),
  ('get-calls', 'get-calls-replying-to-leads-set-up-connector-co-pilot', 'get-calls-replying-to-leads-how-to-activate-the-ai-and-test', 'activate'),
  ('get-calls', 'get-calls-lead-generation-get-started-with-connector', 'get-calls-lead-generation-ai-automation-what-is-connector-how-to-register-for-connector-ai', 'register'),
  ('get-calls', 'get-calls-lead-generation-get-started-with-connector', 'get-calls-lead-generation-ai-automation-connector-campaign-overview', 'overview'),
  ('get-calls', 'get-calls-lead-generation-get-started-with-connector', 'get-calls-lead-generation-ai-automation-write-a-linkedin-connection-message', 'connection-message'),
  ('get-calls', 'get-calls-lead-generation-get-started-with-connector', 'get-calls-lead-generation-ai-automation-connector-campaign-editing-follow-up-message-templates', 'follow-up-templates'),
  ('get-calls', 'get-calls-lead-generation-launch-your-connector-campaign', 'get-calls-lead-generation-ai-automation-how-to-create-campaigns-in-connect-ai', 'create-campaign'),
  ('get-calls', 'get-calls-lead-generation-launch-your-connector-campaign', 'get-calls-lead-generation-ai-automation-how-to-create-a-campaign-for-prospects-you-are-already-connected-with', 'connected-campaign'),
  ('get-calls', 'get-calls-lead-generation-launch-your-connector-campaign', 'get-calls-lead-generation-ai-automation-targeted-open-inmail-craft-open-inmail-message', 'open-inmail'),
  ('win-clients', 'win-clients-design-your-coaching-offer', 'coach-action-plan-building-a-world-class-coaching-practice-57m-what-are-people-actually-buying-the-gap', 'the-gap'),
  ('win-clients', 'win-clients-design-your-coaching-offer', 'coach-action-plan-building-a-world-class-coaching-practice-57m-structuring-your-coaching-offer-what-are-you-actually-selling', 'structure'),
  ('win-clients', 'win-clients-design-your-coaching-offer', 'coach-action-plan-building-a-world-class-coaching-practice-57m-pricing-setting-the-right-packages-investment-for-your-coaching', 'pricing'),
  ('win-clients', 'win-clients-deliver-your-sales-pitch', 'win-clients-sales-pitch-sales-pitch-overview', 'overview'),
  ('win-clients', 'win-clients-deliver-your-sales-pitch', 'win-clients-sales-pitch-sales-call-pitching-principles', 'principles'),
  ('win-clients', 'win-clients-deliver-your-sales-pitch', 'win-clients-sales-pitch-sales-call-transition-into-pitch', 'transition'),
  ('win-clients', 'win-clients-deliver-your-sales-pitch', 'win-clients-sales-pitch-sales-call-the-pitch', 'the-pitch'),
  ('win-clients', 'win-clients-deliver-your-sales-pitch', 'win-clients-sales-pitch-sales-call-asking-questions-in-the-pitch', 'questions-in-pitch'),
  ('win-clients', 'win-clients-deliver-your-sales-pitch', 'win-clients-sales-pitch-sales-pitch-demo-perfecting-your-pitch-performance', 'demo'),
  ('win-clients', 'win-clients-deliver-your-sales-pitch', 'win-clients-sales-pitch-how-to-share-slides-on-a-sales-call-so-they-don-t-see-your-script', 'share-slides'),
  ('win-clients', 'win-clients-post-pitch-price-and-close', 'win-clients-sales-pitch-sales-call-post-pitch-checking-for-questions', 'check-questions'),
  ('win-clients', 'win-clients-post-pitch-price-and-close', 'win-clients-sales-pitch-sales-call-post-pitch-framework-for-answering-questions', 'answer-framework'),
  ('win-clients', 'win-clients-post-pitch-price-and-close', 'win-clients-sales-pitch-post-pitch-process', 'post-pitch-process'),
  ('win-clients', 'win-clients-post-pitch-price-and-close', 'win-clients-sales-pitch-price-pitch', 'price-pitch'),
  ('win-clients', 'win-clients-post-pitch-price-and-close', 'win-clients-sales-pitch-sales-process-questions-when-should-you-discuss-price', 'when-price'),
  ('coach-clients', 'coach-clients-start-and-end-a-coaching-session', 'coach-clients-coachiing-session-structure-how-to-start-a-coaching-session', 'start'),
  ('coach-clients', 'coach-clients-start-and-end-a-coaching-session', 'coach-clients-coachiing-session-structure-how-eo-end-a-coaching-session', 'end'),
  ('coach-clients', 'coach-clients-certification-welcome-to-profit-coach-certification', 'coach-clients-certification-welcome-to-the-profit-coach-certification-welcome-to-your-coaching-transformation', 'welcome'),
  ('coach-clients', 'coach-clients-certification-welcome-to-profit-coach-certification', 'coach-clients-certification-welcome-to-the-profit-coach-certification-how-to-maximise-your-certification-experience', 'maximise'),
  ('coach-clients', 'coach-clients-certification-welcome-to-profit-coach-certification', 'coach-clients-certification-welcome-to-the-profit-coach-certification-meet-your-faculty-our-coaching-philosophy', 'faculty'),
  ('coach-clients', 'coach-clients-certification-welcome-to-profit-coach-certification', 'coach-clients-certification-welcome-to-the-profit-coach-certification-profit-coacbh-roi-calculator', 'roi-calculator'),
  ('coach-clients', 'coach-clients-certification-welcome-to-profit-coach-certification', 'coach-clients-certification-welcome-to-the-profit-coach-certification-profit-coach-certification-workbook', 'workbook'),
  ('coach-clients', 'coach-clients-certification-week-1-coach-foundations', 'coach-clients-certification-coaching-foundations-what-is-coaching', 'what-is-coaching'),
  ('coach-clients', 'coach-clients-certification-week-1-coach-foundations', 'coach-action-plan-building-a-world-class-coaching-practice-57m-what-is-your-coaching-style-3-traits-that-define-how-you-coach', 'coaching-style'),
  ('coach-clients', 'coach-clients-certification-week-1-coach-foundations', 'coach-clients-certification-coaching-foundations-the-power-of-effective-feedback', 'feedback'),
  ('coach-clients', 'coach-clients-certification-week-1-coach-foundations', 'coach-clients-certification-coaching-foundations-the-use-it-or-lose-it-principle', 'use-it-or-lose-it'),
  ('coach-clients', 'coach-clients-certification-week-1-coach-foundations', 'coach-clients-certification-coaching-foundations-core-skill-active-listening-demo', 'active-listening'),
  ('coach-clients', 'coach-clients-certification-week-1-coach-foundations', 'coach-clients-certification-coaching-foundations-the-coach-method-overview', 'coach-overview'),
  ('coach-clients', 'coach-clients-certification-week-1-coach-foundations', 'coach-clients-certification-coaching-foundations-using-the-coach-method', 'using-coach'),
  ('coach-clients', 'coach-clients-certification-week-1-coach-foundations', 'coach-clients-certification-coaching-foundations-the-coaching-cube', 'coaching-cube'),
  ('coach-clients', 'coach-clients-certification-week-1-coach-foundations', 'coach-clients-certification-coaching-foundations-client-simulator-coach-practice', 'simulator'),
  ('coach-clients', 'coach-clients-certification-week-1-coach-foundations', 'coach-clients-certification-coaching-foundations-live-coaching-session-demo', 'live-demo'),
  ('coach-clients', 'coach-clients-certification-week-1-coach-foundations', 'coach-clients-certification-coaching-foundations-ideal-session-structure', 'ideal-structure'),
  ('coach-clients', 'coach-clients-certification-week-1-coach-foundations', 'coach-clients-certification-coaching-foundations-how-coach-creates-more-sessions', 'more-sessions'),
  ('coach-clients', 'coach-clients-certification-week-1-coach-foundations', 'coach-clients-certification-coaching-foundations-coach-foundations-review', 'review'),
  ('coach-clients', 'coach-clients-certification-week-1-coach-foundations', 'coach-clients-certification-coaching-foundations-week-1-quiz-introduction-and-coach', 'week-1-quiz'),
  ('coach-clients', 'coach-clients-certification-week-2-powerful-questions', 'coach-clients-certification-the-exact-questions-to-ask-clients-icf-8-core-competencies', 'icf'),
  ('coach-clients', 'coach-clients-certification-week-2-powerful-questions', 'coach-clients-certification-the-exact-questions-to-ask-clients-the-power-framework-overview', 'power-overview'),
  ('coach-clients', 'coach-clients-certification-week-2-powerful-questions', 'coach-clients-certification-the-exact-questions-to-ask-clients-how-to-ask-powerful-questions-exercises', 'exercises'),
  ('coach-clients', 'coach-clients-certification-week-2-powerful-questions', 'coach-clients-certification-the-exact-questions-to-ask-clients-powerful-vs-transformational-questions', 'powerful-vs-transformational'),
  ('coach-clients', 'coach-clients-certification-week-2-powerful-questions', 'coach-clients-certification-the-exact-questions-to-ask-clients-communication-skills-assessment', 'comm-assessment'),
  ('coach-clients', 'coach-clients-certification-week-2-powerful-questions', 'coach-clients-certification-the-exact-questions-to-ask-clients-the-power-framework-detail', 'power-detail'),
  ('coach-clients', 'coach-clients-certification-week-2-powerful-questions', 'coach-clients-certification-the-exact-questions-to-ask-clients-week-2-coach-superpowers-review', 'week-2-review'),
  ('coach-clients', 'coach-clients-certification-week-2-powerful-questions', 'coach-clients-certification-the-exact-questions-to-ask-clients-client-simullator-profitabilty-issues-management-consultant', 'simulator'),
  ('coach-clients', 'coach-clients-certification-week-2-powerful-questions', 'coach-clients-certification-the-exact-questions-to-ask-clients-becoming-a-great-coach-quiz', 'great-coach-quiz'),
  ('coach-clients', 'coach-clients-certification-week-2-powerful-questions', 'coach-clients-certification-the-exact-questions-to-ask-clients-superpowers-quiz', 'superpowers-quiz'),
  ('coach-clients', 'coach-clients-certification-week-2-powerful-questions', 'coach-clients-certification-the-exact-questions-to-ask-clients-questioning-and-listening-quiz', 'questioning-quiz'),
  ('coach-clients', 'coach-clients-certification-week-3-lasting-transformation', 'coach-clients-certification-create-lasting-transformation-sprint-week-3-overview', 'overview'),
  ('coach-clients', 'coach-clients-certification-week-3-lasting-transformation', 'coach-clients-certification-create-lasting-transformation-creating-sustainable-transformation', 'sustainable'),
  ('coach-clients', 'coach-clients-certification-week-3-lasting-transformation', 'coach-clients-certification-create-lasting-transformation-how-to-continually-add-value', 'add-value'),
  ('coach-clients', 'coach-clients-certification-week-3-lasting-transformation', 'coach-clients-certification-create-lasting-transformation-coaching-mindset', 'mindset'),
  ('coach-clients', 'coach-clients-certification-week-3-lasting-transformation', 'coach-clients-certification-create-lasting-transformation-controlling-your-state-of-mind', 'state-of-mind'),
  ('coach-clients', 'coach-clients-certification-week-3-lasting-transformation', 'coach-clients-certification-create-lasting-transformation-how-psychology-affects-mindset', 'psychology'),
  ('coach-clients', 'coach-clients-certification-week-3-lasting-transformation', 'coach-clients-certification-create-lasting-transformation-use-vocabulary-to-change-perception', 'vocabulary'),
  ('coach-clients', 'coach-clients-certification-week-3-lasting-transformation', 'coach-clients-certification-create-lasting-transformation-coaching-mindset-quiz', 'mindset-quiz'),
  ('coach-clients', 'coach-clients-certification-week-3-lasting-transformation', 'coach-clients-certification-create-lasting-transformation-how-to-use-the-coaching-sheet-in-sessions', 'coaching-sheet'),
  ('coach-clients', 'coach-clients-certification-week-3-lasting-transformation', 'coach-clients-certification-create-lasting-transformation-coachin-a-person-feedback-review', 'feedback-review'),
  ('coach-clients', 'coach-clients-certification-week-3-lasting-transformation', 'coach-clients-certification-create-lasting-transformation-pros-cons-coachin-ai-vs-person', 'ai-vs-person'),
  ('coach-clients', 'coach-clients-certification-week-3-lasting-transformation', 'coach-clients-certification-create-lasting-transformation-advanced-coaching-skills-selling', 'advanced-selling'),
  ('coach-clients', 'coach-clients-certification-week-3-lasting-transformation', 'coach-clients-certification-create-lasting-transformation-sprint-week-3-review-homework', 'homework'),
  ('coach-clients', 'coach-clients-certification-week-4-world-class-coach', 'coach-clients-certification-becoming-a-world-class-business-coach-coaching-as-a-leader', 'coaching-as-leader'),
  ('coach-clients', 'coach-clients-certification-week-4-world-class-coach', 'coach-clients-certification-becoming-a-world-class-business-coach-coaching-as-a-leader-quiz', 'leader-quiz'),
  ('coach-clients', 'coach-clients-certification-week-4-world-class-coach', 'coach-clients-certification-becoming-a-world-class-business-coach-ethical-dilemmas-and-difficult-situations', 'ethics'),
  ('coach-clients', 'coach-clients-certification-week-4-world-class-coach', 'coach-clients-certification-becoming-a-world-class-business-coach-ethical-dilemas-quiz', 'ethics-quiz'),
  ('coach-clients', 'coach-clients-certification-week-4-world-class-coach', 'coach-clients-certification-becoming-a-world-class-business-coach-client-sessions-using-tools', 'using-tools'),
  ('coach-clients', 'coach-clients-certification-week-4-world-class-coach', 'coach-clients-certification-becoming-a-world-class-business-coach-example-using-tools-coach-method', 'tools-example'),
  ('coach-clients', 'coach-clients-certification-week-4-world-class-coach', 'coach-clients-certification-becoming-a-world-class-business-coach-master-coach-to-master-selling', 'master-selling'),
  ('coach-clients', 'coach-clients-certification-week-4-world-class-coach', 'coach-clients-certification-becoming-a-world-class-business-coach-business-coach-certification-assessment', 'assessment'),
  ('coach-clients', 'coach-clients-certification-week-4-world-class-coach', 'coach-clients-certification-becoming-a-world-class-business-coach-certification-feedback-survey', 'feedback-survey'),
  ('coach-clients', 'coach-clients-certification-week-4-world-class-coach', 'coach-clients-certification-becoming-a-world-class-business-coach-certificaiton-round-up-next-steps', 'round-up'),
  ('coach-clients', 'coach-clients-certification-week-4-world-class-coach', 'coach-clients-certification-becoming-a-world-class-business-coach-business-blueprint', 'blueprint');

-- 1) Chapter ticks from completed legacy lessons
insert into public.academy_lesson_chapter_progress (
  user_id,
  course_id,
  lesson_id,
  chapter_id,
  completed_at
)
select
  p.user_id,
  m.course_id,
  m.parent_lesson_id,
  m.chapter_id,
  coalesce(p.updated_at, now())
from public.academy_lesson_progress p
join _consolidation_chapter_map m
  on m.legacy_lesson_id = p.lesson_id
where p.status = 'completed'
on conflict (user_id, course_id, lesson_id, chapter_id) do nothing;

-- 2) Parent lesson completed when every mapped chapter is done
insert into public.academy_lesson_progress (
  user_id,
  course_id,
  lesson_id,
  status,
  updated_at
)
select
  done.user_id,
  done.course_id,
  done.parent_lesson_id,
  'completed',
  now()
from (
  select
    cp.user_id,
    m.course_id,
    m.parent_lesson_id,
    count(distinct m.chapter_id) as done_chapters,
    (
      select count(distinct m2.chapter_id)
      from _consolidation_chapter_map m2
      where m2.parent_lesson_id = m.parent_lesson_id
    ) as required_chapters
  from public.academy_lesson_chapter_progress cp
  join _consolidation_chapter_map m
    on m.parent_lesson_id = cp.lesson_id
   and m.chapter_id = cp.chapter_id
   and m.course_id = cp.course_id
  group by cp.user_id, m.course_id, m.parent_lesson_id
) done
where done.done_chapters >= done.required_chapters
on conflict (user_id, course_id, lesson_id) do update set
  status = case
    when public.academy_lesson_progress.status = 'completed' then 'completed'
    else excluded.status
  end,
  updated_at = greatest(public.academy_lesson_progress.updated_at, excluded.updated_at);
