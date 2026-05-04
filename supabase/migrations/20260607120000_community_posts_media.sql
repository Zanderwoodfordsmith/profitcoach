-- Multiple images/videos per community post (max 6). Keeps image_url as first image for legacy consumers.

alter table public.community_posts
  add column if not exists media jsonb;

-- Backfill from legacy single image
update public.community_posts
set media = jsonb_build_array(
  jsonb_build_object('url', image_url, 'kind', 'image')
)
where trim(coalesce(image_url, '')) <> ''
  and (
    media is null
    or jsonb_typeof(media) <> 'array'
    or jsonb_array_length(media) = 0
  );

alter table public.community_posts
  drop constraint if exists community_posts_media_array_len;

alter table public.community_posts
  add constraint community_posts_media_array_len
  check (
    media is null
    or (
      jsonb_typeof(media) = 'array'
      and jsonb_array_length(media) >= 1
      and jsonb_array_length(media) <= 6
    )
  );
