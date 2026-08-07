-- Coach Clients · Client Simulators: recommended actions (practice sims + certification assessment).
-- Content stored under profit-coach-certification programme course_id.

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"run-coach-practice-1","text":"Run Client Simulator: Coach Practice 1 with microphone on"},
    {"id":"request-sim-feedback","text":"End with: \"That concludes our coaching session. I''d like to receive feedback now.\" and review the scores"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'profit-coach-certification'
  and lesson_id = 'profit-coach-certification-client-simulators-client-simulator-coach-practice-1';

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"run-thai-restaurant-sim","text":"Coach Ana (Thai restaurant revenue optimisation) in the simulator"},
    {"id":"request-feedback-thai","text":"Request feedback at the end and note one improvement to try next"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'profit-coach-certification'
  and lesson_id = 'profit-coach-certification-client-simulators-revenue-optmisation-thai-restaurant';

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"run-mgmt-consultant-sim","text":"Coach the management-consultant profitability scenario (slow down; use powerful questions)"},
    {"id":"request-feedback-consultant","text":"Request feedback at the end and note one improvement to try next"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'profit-coach-certification'
  and lesson_id = 'profit-coach-certification-client-simulators-client-simulator-profitability-issues-management-consultant';

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"run-chiropractor-sim","text":"Coach Marcus (multi-location chiropractor operations) in the simulator"},
    {"id":"request-feedback-chiro","text":"Request feedback at the end and note one improvement to try next"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'profit-coach-certification'
  and lesson_id = 'profit-coach-certification-client-simulators-multi-location-operaitons-issues-chiropractor';

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"run-manufacturing-sim","text":"Coach David (manufacturing/engineering pressure) in the simulator"},
    {"id":"request-feedback-mfg","text":"Request feedback at the end and note one improvement to try next"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'profit-coach-certification'
  and lesson_id = 'profit-coach-certification-client-simulators-business-pressure-manufacturing-engineering';

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"run-legal-saas-sim","text":"Coach Alex (legal services / SaaS, diverse units) in the simulator"},
    {"id":"request-feedback-legal","text":"Request feedback at the end and note one improvement to try next"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'profit-coach-certification'
  and lesson_id = 'profit-coach-certification-client-simulators-diverse-business-units-legal-saas';

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"complete-cert-assessment","text":"Complete the Business Coach Certification assessment with Helen (say your full name at the start)"},
    {"id":"end-assessment-when-done","text":"End the call as soon as coaching is finished (extra talk hurts the transcript score)"},
    {"id":"email-assessment-complete","text":"Email support@businesscoachacademy.com with subject COACH Assessment, including date and time"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'profit-coach-certification'
  and lesson_id = 'profit-coach-certification-client-simulators-business-coach-certificaiton-assessment';
