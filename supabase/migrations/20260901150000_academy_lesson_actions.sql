-- Recommended lesson actions (Overview right column) + My Actions provenance.

-- ---------------------------------------------------------------------------
-- Academy lesson content: curated action checklist
-- ---------------------------------------------------------------------------
alter table public.academy_lesson_content
  add column if not exists recommended_actions jsonb not null default '[]'::jsonb;

comment on column public.academy_lesson_content.recommended_actions is
  'JSON array of { id, text } recommended next steps shown on the Overview tab.';

alter table public.academy_lesson_content
  drop constraint if exists academy_lesson_content_recommended_actions_is_array;
alter table public.academy_lesson_content
  add constraint academy_lesson_content_recommended_actions_is_array
  check (jsonb_typeof(recommended_actions) = 'array');

-- ---------------------------------------------------------------------------
-- Coach action items: link personal actions back to an academy lesson
-- ---------------------------------------------------------------------------
alter table public.coach_action_items
  add column if not exists academy_course_id text;

alter table public.coach_action_items
  add column if not exists academy_lesson_id text;

alter table public.coach_action_items
  add column if not exists academy_recommended_action_id text;

comment on column public.coach_action_items.academy_course_id is
  'When set, this item was created from an academy lesson (My Actions).';

comment on column public.coach_action_items.academy_lesson_id is
  'Academy lesson id when created from lesson Overview actions.';

comment on column public.coach_action_items.academy_recommended_action_id is
  'Matches recommended_actions[].id when this row tracks a curated lesson action; null for coach-authored items.';

create index if not exists coach_action_items_academy_lesson_idx
  on public.coach_action_items (coach_id, academy_lesson_id)
  where academy_lesson_id is not null;

-- ---------------------------------------------------------------------------
-- Starter actions for visual QA and the first onboarding tasks
-- ---------------------------------------------------------------------------
insert into public.academy_lesson_content (
  course_id,
  lesson_id,
  recommended_actions
)
values
  (
    'kickstart',
    'kickstart-welcome-introduce-yourself',
    '[{"id":"post-introduction","text":"Post your introduction in the community"}]'::jsonb
  ),
  (
    'kickstart',
    'kickstart-welcome-calendar-calls',
    '[{"id":"add-calls-calendar","text":"Add the coaching calls to your calendar"}]'::jsonb
  ),
  (
    'client-acquisition',
    'client-acquisition-ideal-clients-linkedin-sales-navigator-build-your-base-search',
    '[
      {"id":"open-base-search","text":"Open Sales Navigator and start a new lead search"},
      {"id":"apply-ideal-client-filters","text":"Apply the ideal-client filters from this lesson"},
      {"id":"save-search-and-prospects","text":"Save the search and add your first 25 prospects"}
    ]'::jsonb
  )
on conflict (course_id, lesson_id) do update
set
  recommended_actions = excluded.recommended_actions,
  updated_at = now();
