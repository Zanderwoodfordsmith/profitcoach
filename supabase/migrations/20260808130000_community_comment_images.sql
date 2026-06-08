-- Optional image attachments on community comments (staff, max 3).

alter table public.community_post_comments
  add column if not exists media jsonb;

alter table public.community_post_comments
  drop constraint if exists community_post_comments_media_array_len;

alter table public.community_post_comments
  add constraint community_post_comments_media_array_len
  check (
    media is null
    or (
      jsonb_typeof(media) = 'array'
      and jsonb_array_length(media) >= 1
      and jsonb_array_length(media) <= 3
    )
  );
