-- Directory coach page: the parts of a coach's public page that are not
-- already profile columns. Career rows, client results, who they help, a
-- booking link and the photo focus point. Empty means "not filled in yet":
-- the live page hides that section, the coach's edit view shows a prompt.
alter table public.profiles
  add column if not exists directory_page jsonb not null default '{}'::jsonb;

comment on column public.profiles.directory_page is
  'Directory page extras edited on /directory/[slug]: career, results, serves, industries, booking_url, photo_focus.';
