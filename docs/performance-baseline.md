# Performance baseline (Community + Compass)

Use this checklist before and after feed or Compass changes so you can see real impact.

## Browser (local)

1. Open DevTools → **Network**. Disable cache. Hard-reload the page under test.
2. Note **request count**, **total transfer size**, and **finish** time for:
   - `/coach/community` (feed tab): look for Supabase REST calls (`/rest/v1/`) and any `rpc`.
   - `/coach/signature` (Compass): note `/api/profile-role` and `/api/coach/signature-scores` timing and whether they overlap.
3. Filter Network by `community_post` / `rpc` to confirm the feed is not loading unbounded comment threads (after migration you should see `community_feed_comment_preview_rows` instead of huge `community_post_comments` responses).

## Supabase

1. Dashboard → **Reports** → **Query performance** (or Logs) for slow queries.
2. Watch `community_post_comments` and `community_posts` row counts returned by API — list views should stay small (page size × light columns + preview RPC rows only).

## Dev-only timings

In development, the app logs `[perf] communityFeed:loadPosts` and `[perf] compass:init` durations to the console when those flows complete (see `src/lib/devPerf.ts`).

## After `20260608120000_community_posts_feed_counters`

- `community_posts` rows include `feed_comment_count`, `feed_like_count`, and `last_comment_at` maintained by triggers.
- Feed enrichment uses RPC `community_feed_comment_preview_rows` for avatar strips instead of loading every comment for the page.
