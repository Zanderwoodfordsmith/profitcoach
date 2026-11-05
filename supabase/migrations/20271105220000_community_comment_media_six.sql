-- Community comments can carry up to 6 attachments (pictures, videos,
-- voice notes, documents). Was 3.

alter table public.community_post_comments
  drop constraint if exists community_post_comments_media_array_len;

alter table public.community_post_comments
  add constraint community_post_comments_media_array_len
  check (
    media is null
    or (
      jsonb_typeof(media) = 'array'
      and jsonb_array_length(media) >= 1
      and jsonb_array_length(media) <= 6
    )
  );
