-- Win Clients · Client Closing: recommended actions from seeded objection guides.

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"memorise-six-objections","text":"Memorise the six real objections: process/product, value, money, partner, timing, fear"},
    {"id":"practise-options-question","text":"Practise the person-to-person options question (money, time, partner, fear) for when you cannot find the real concern"},
    {"id":"deflect-send-me-email","text":"Practise deflecting \"send me an email/proposal\" by asking what specifically they want included"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'client-acquisition'
  and lesson_id = 'client-acquisition-client-closing-find-the-real-objection';

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"memorise-closing-loops","text":"Memorise the closing-loop sequence (re-open → isolate → reframe → ask again)"},
    {"id":"practise-loops-out-loud","text":"Practise Loops 0–2 out loud until you can run them calmly without notes"},
    {"id":"set-loop-limit","text":"Decide your release rule: loop only 3–4 times, then release well"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'client-acquisition'
  and lesson_id = 'client-acquisition-client-closing-universal-closing-loops';

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"practise-diffuse-and-retie","text":"Practise the \"time to think\" sequence: diffuse, re-tie to their goal, then ask what they will actually be thinking about"},
    {"id":"expect-think-objection","text":"Expect \"I need time to think\" on almost every call and treat it as a doorway, not a no"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'client-acquisition'
  and lesson_id = 'client-acquisition-client-closing-time-to-think-objection';

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"practise-expensive-fork","text":"Practise the \"expensive\" fork: comparing to something specific vs more than they can afford right now"},
    {"id":"retie-before-payment-plan","text":"Always re-tie to the goal and confirm they are bought in before offering a payment plan"},
    {"id":"prepare-two-pay-options","text":"Prepare two payment-plan options so either answer is a close"},
    {"id":"use-deposit-not-drift","text":"If you cannot close today, aim for a refundable deposit plus a booked follow-up — never \"email me next week\""}
  ]'::jsonb,
  updated_at = now()
where course_id = 'client-acquisition'
  and lesson_id = 'client-acquisition-client-closing-money-objection';

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"ask-permission-or-fyi","text":"Practise asking whether the partner chat is permission-based or FYI"},
    {"id":"qualify-partner-conversation","text":"On permission path, qualify the partner conversation (awareness of the problem, support, budget without checking in)"},
    {"id":"keep-both-decision-makers-on-call","text":"If both decision-makers are present, keep them on the call for a short private mute rather than \"discuss later\""}
  ]'::jsonb,
  updated_at = now()
where course_id = 'client-acquisition'
  and lesson_id = 'client-acquisition-client-closing-partner-objection';

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"split-bandwidth-vs-timeframe","text":"Split timing objections into bandwidth vs calendar timeframe before you solve logistics"},
    {"id":"retie-then-solve-time","text":"Re-tie to the goal first; only solve time once they clearly believe it will work"},
    {"id":"attach-date-and-commitment","text":"Never accept \"later\" without a date, a structure (delayed start/deposit), and some commitment"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'client-acquisition'
  and lesson_id = 'client-acquisition-client-closing-timing-objection';

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"diagnose-fear-root","text":"Diagnose fear early: fear of the past (burned before) vs fear of the future (never invested)"},
    {"id":"pick-two-fear-reframes","text":"Pick two fear reframes to practise first (e.g. Guarantee + Burned In The Past, or Never Invested + What Would You Do)"},
    {"id":"use-empathy-not-proof-stack","text":"When fear shows up, slow down and rationalise the emotion — do not stack more case studies as pressure"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'client-acquisition'
  and lesson_id = 'client-acquisition-client-closing-fear-objection';

update public.academy_lesson_content
set
  recommended_actions = '[
    {"id":"practise-why-not-them","text":"Practise the \"Why aren''t you going with them?\" competitor-price close"},
    {"id":"walk-contract-live","text":"If they ask for the contract, walk it through live on screen instead of emailing it away"},
    {"id":"sell-through-after-yes","text":"After a yes, keep selling through and after the close so they leave in confidence, not panic"},
    {"id":"release-well-on-no","text":"If it is a genuine no, release well and only book a follow-up when it is real"}
  ]'::jsonb,
  updated_at = now()
where course_id = 'client-acquisition'
  and lesson_id = 'client-acquisition-client-closing-universal-closes-final-moves';
