-- Coach-facing academy resource library (worksheets, SOPs, links). Attachable to programme lessons.

create table if not exists public.academy_resource_sections (
  id text primary key,
  area text not null check (area in ('coach-delivery', 'profit-system')),
  parent_id text references public.academy_resource_sections (id) on delete cascade,
  title text not null,
  sort_order integer not null default 0
);

comment on table public.academy_resource_sections is
  'Grouped sections for academy resources (coach delivery, profit system, etc.).';

create table if not exists public.academy_resources (
  id uuid primary key default gen_random_uuid(),
  section_id text not null references public.academy_resource_sections (id) on delete cascade,
  topic text,
  title text not null,
  url text not null,
  resource_kind text not null default 'link',
  sort_order integer not null default 0,
  source_line integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (section_id, url, title)
);

comment on table public.academy_resources is
  'External worksheets, SOPs, articles, and tools linked from academy programmes.';

create index if not exists academy_resources_section_id_idx
  on public.academy_resources (section_id);

create index if not exists academy_resources_topic_idx
  on public.academy_resources (section_id, topic);

create table if not exists public.academy_lesson_resources (
  course_id text not null,
  lesson_id text not null,
  resource_id uuid not null references public.academy_resources (id) on delete cascade,
  sort_order integer not null default 0,
  primary key (course_id, lesson_id, resource_id)
);

comment on table public.academy_lesson_resources is
  'Optional links from legacy-hub / classroom lessons to academy_resources rows.';

create index if not exists academy_lesson_resources_lesson_idx
  on public.academy_lesson_resources (course_id, lesson_id);
