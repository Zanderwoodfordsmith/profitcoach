-- Feed pagination and filter performance indexes.

create index if not exists community_posts_feed_pin_created_idx
  on public.community_posts (is_pinned, created_at desc);

create index if not exists community_posts_feed_category_created_idx
  on public.community_posts (category_id, created_at desc);

create index if not exists community_post_favourites_user_created_idx
  on public.community_post_favourites (user_id, created_at desc);

create index if not exists community_post_comments_post_created_idx
  on public.community_post_comments (post_id, created_at desc);
