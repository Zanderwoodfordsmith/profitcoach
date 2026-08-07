-- Admin draft / soft-delete flags for academy lessons (merged over hub / catalog JSON).
alter table public.academy_lesson_content
  add column if not exists is_draft boolean not null default false;

alter table public.academy_lesson_content
  add column if not exists is_deleted boolean not null default false;

comment on column public.academy_lesson_content.is_draft is
  'When true, lesson is visible to admins only (hidden from coaches).';

comment on column public.academy_lesson_content.is_deleted is
  'Soft-delete: lesson is hidden from all academy UIs until removed from catalog JSON.';
