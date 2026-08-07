-- Allow LinkedIn scheduled posts to be videos; expand media bucket for MP4.

alter table public.linkedin_scheduled_posts
  drop constraint if exists linkedin_scheduled_posts_post_type_check;

alter table public.linkedin_scheduled_posts
  add constraint linkedin_scheduled_posts_post_type_check
  check (post_type in ('text', 'image', 'multi_image', 'article', 'video'));

update storage.buckets
set
  file_size_limit = 209715200,
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4'
  ]
where id = 'linkedin-media';
