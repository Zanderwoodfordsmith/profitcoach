-- Comment likes table (idempotent) + aggregated counts for post detail load.
-- Includes 20260515120000_community_comment_likes in case that migration was never applied.

create table if not exists public.community_comment_likes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.community_post_comments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (comment_id, user_id)
);

create index if not exists community_comment_likes_comment_id_idx
  on public.community_comment_likes (comment_id);

create index if not exists community_comment_likes_user_id_idx
  on public.community_comment_likes (user_id);

alter table public.community_comment_likes enable row level security;

drop policy if exists "Staff read community_comment_likes" on public.community_comment_likes;
create policy "Staff read community_comment_likes"
  on public.community_comment_likes for select
  to authenticated
  using (public.is_staff_community());

drop policy if exists "Staff insert own community_comment_likes" on public.community_comment_likes;
create policy "Staff insert own community_comment_likes"
  on public.community_comment_likes for insert
  to authenticated
  with check (
    public.is_staff_community()
    and user_id = auth.uid()
  );

drop policy if exists "Staff delete own community_comment_likes" on public.community_comment_likes;
create policy "Staff delete own community_comment_likes"
  on public.community_comment_likes for delete
  to authenticated
  using (
    public.is_staff_community()
    and user_id = auth.uid()
  );

create or replace function public.community_post_comment_like_stats(
  p_comment_ids uuid[],
  p_viewer_id uuid default null
)
returns table (
  comment_id uuid,
  like_count int,
  liked_by_viewer boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id as comment_id,
    coalesce(lc.cnt, 0)::int as like_count,
    (
      p_viewer_id is not null
      and exists (
        select 1
        from public.community_comment_likes l
        where l.comment_id = c.id
          and l.user_id = p_viewer_id
      )
    ) as liked_by_viewer
  from unnest(p_comment_ids) as c(id)
  left join lateral (
    select count(*)::int as cnt
    from public.community_comment_likes l
    where l.comment_id = c.id
  ) lc on true;
$$;

revoke all on function public.community_post_comment_like_stats(uuid[], uuid) from public;
grant execute on function public.community_post_comment_like_stats(uuid[], uuid) to service_role;
