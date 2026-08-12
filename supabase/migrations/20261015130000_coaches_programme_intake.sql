-- Soft programme intake captured after orientation booking on /welcome.
alter table public.coaches
  add column if not exists programme_intake jsonb;

comment on column public.coaches.programme_intake is
  'Optional post-enrolment intake (LinkedIn, situation, goal, time commitment).';
