-- Denormalized like/comment counts + last comment time for fast community feed cards.
-- Maintained by SECURITY DEFINER triggers (RLS would block commenters from updating others' posts).
-- body_preview: first 400 chars for list payloads (full body unchanged for detail views).

alter table public.community_posts
  add column if not exists feed_comment_count integer not null default 0;

alter table public.community_posts
  add column if not exists feed_like_count integer not null default 0;

alter table public.community_posts
  add column if not exists last_comment_at timestamptz;

alter table public.community_posts
  add column if not exists body_preview text
  generated always as (left(trim(body), 400)) stored;

comment on column public.community_posts.feed_comment_count is 'Denormalized count of community_post_comments rows for this post.';
comment on column public.community_posts.feed_like_count is 'Denormalized count of community_post_likes rows for this post.';
comment on column public.community_posts.last_comment_at is 'Max(community_post_comments.created_at) for this post; null if no comments.';
comment on column public.community_posts.body_preview is 'First 400 chars of body for list views; full body remains in body.';

update public.community_posts p
set
  feed_comment_count = coalesce(s.cc, 0),
  feed_like_count = coalesce(s.lc, 0),
  last_comment_at = s.lca
from (
  select
    p2.id,
    (
      select count(*)::int
      from public.community_post_comments c
      where c.post_id = p2.id
    ) as cc,
    (
      select count(*)::int
      from public.community_post_likes l
      where l.post_id = p2.id
    ) as lc,
    (
      select max(c2.created_at)
      from public.community_post_comments c2
      where c2.post_id = p2.id
    ) as lca
  from public.community_posts p2
) s
where p.id = s.id;

-- --- Triggers: comments ---
create or replace function public._community_posts_comment_stats_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  pid uuid;
  op_old uuid;
  op_new uuid;
begin
  if tg_op = 'DELETE' then
    pid := old.post_id;
    update public.community_posts
    set
      feed_comment_count = greatest(feed_comment_count - 1, 0),
      last_comment_at = (
        select max(c.created_at)
        from public.community_post_comments c
        where c.post_id = pid
      )
    where id = pid;
    return old;
  elsif tg_op = 'INSERT' then
    pid := new.post_id;
    update public.community_posts
    set
      feed_comment_count = feed_comment_count + 1,
      last_comment_at = case
        when last_comment_at is null or new.created_at > last_comment_at then new.created_at
        else last_comment_at
      end
    where id = pid;
    return new;
  elsif tg_op = 'UPDATE' then
    op_old := old.post_id;
    op_new := new.post_id;
    if op_old is distinct from op_new then
      update public.community_posts
      set
        feed_comment_count = greatest(feed_comment_count - 1, 0),
        last_comment_at = (
          select max(c.created_at)
          from public.community_post_comments c
          where c.post_id = op_old
        )
      where id = op_old;
      update public.community_posts
      set
        feed_comment_count = feed_comment_count + 1,
        last_comment_at = case
          when last_comment_at is null or new.created_at > last_comment_at then new.created_at
          else last_comment_at
        end
      where id = op_new;
    end if;
    return new;
  end if;
  return coalesce(new, old);
end;
$fn$;

drop trigger if exists community_posts_comment_stats_ins on public.community_post_comments;
create trigger community_posts_comment_stats_ins
  after insert on public.community_post_comments
  for each row
  execute procedure public._community_posts_comment_stats_trigger();

drop trigger if exists community_posts_comment_stats_del on public.community_post_comments;
create trigger community_posts_comment_stats_del
  after delete on public.community_post_comments
  for each row
  execute procedure public._community_posts_comment_stats_trigger();

drop trigger if exists community_posts_comment_stats_upd on public.community_post_comments;
create trigger community_posts_comment_stats_upd
  after update of post_id on public.community_post_comments
  for each row
  execute procedure public._community_posts_comment_stats_trigger();

-- --- Triggers: likes ---
create or replace function public._community_posts_like_stats_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  pid uuid;
begin
  if tg_op = 'DELETE' then
    pid := old.post_id;
    update public.community_posts
    set feed_like_count = greatest(feed_like_count - 1, 0)
    where id = pid;
    return old;
  elsif tg_op = 'INSERT' then
    pid := new.post_id;
    update public.community_posts
    set feed_like_count = feed_like_count + 1
    where id = pid;
    return new;
  end if;
  return coalesce(new, old);
end;
$fn$;

drop trigger if exists community_posts_like_stats_ins on public.community_post_likes;
create trigger community_posts_like_stats_ins
  after insert on public.community_post_likes
  for each row
  execute procedure public._community_posts_like_stats_trigger();

drop trigger if exists community_posts_like_stats_del on public.community_post_likes;
create trigger community_posts_like_stats_del
  after delete on public.community_post_likes
  for each row
  execute procedure public._community_posts_like_stats_trigger();

-- --- Bounded comment rows for feed card avatars (first + recent per post) ---
create or replace function public.community_feed_comment_preview_rows(p_post_ids uuid[])
returns table (
  post_id uuid,
  author_id uuid,
  created_at timestamptz,
  full_name text,
  first_name text,
  last_name text,
  avatar_url text
)
language sql
stable
security definer
set search_path = public
as $fn$
  select x.post_id, x.author_id, x.created_at, pr.full_name, pr.first_name, pr.last_name, pr.avatar_url
  from (
    select c.post_id, c.author_id, c.created_at, c.id
    from unnest(p_post_ids) as pid(post_id)
    cross join lateral (
      select y.id, y.post_id, y.author_id, y.created_at
      from public.community_post_comments y
      where y.post_id = pid.post_id
      order by y.created_at asc
      limit 4
    ) c
    union
    select c.post_id, c.author_id, c.created_at, c.id
    from unnest(p_post_ids) as pid2(post_id)
    cross join lateral (
      select y.id, y.post_id, y.author_id, y.created_at
      from public.community_post_comments y
      where y.post_id = pid2.post_id
      order by y.created_at desc
      limit 24
    ) c
  ) x
  join public.profiles pr on pr.id = x.author_id
  where public.is_staff_community();
$fn$;

grant execute on function public.community_feed_comment_preview_rows(uuid[]) to authenticated;
