-- Document posts + explicit link preview title/description (LinkedIn API does not scrape).

alter table public.linkedin_scheduled_posts
  drop constraint if exists linkedin_scheduled_posts_post_type_check;

alter table public.linkedin_scheduled_posts
  add constraint linkedin_scheduled_posts_post_type_check
  check (post_type in ('text', 'image', 'multi_image', 'article', 'video', 'document'));

alter table public.linkedin_scheduled_posts
  add column if not exists article_title text null;

alter table public.linkedin_scheduled_posts
  add column if not exists article_description text null;

alter table public.linkedin_scheduled_posts
  add column if not exists article_thumbnail_url text null;

update storage.buckets
set
  file_size_limit = 209715200,
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
where id = 'linkedin-media';
