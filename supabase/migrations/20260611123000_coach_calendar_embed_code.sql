alter table public.coaches
add column if not exists calendar_embed_code text;

comment on column public.coaches.calendar_embed_code is
  'HTML embed snippet rendered on post-assessment thank-you page.';
