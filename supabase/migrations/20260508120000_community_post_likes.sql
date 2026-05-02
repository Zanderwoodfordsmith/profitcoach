-- Post likes (staff community): one like per user per post

create table if not exists public.community_post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create index if not exists community_post_likes_post_id_idx
  on public.community_post_likes (post_id);

create index if not exists community_post_likes_user_id_idx
  on public.community_post_likes (user_id);

alter table public.community_post_likes enable row level security;

drop policy if exists "Staff read community_post_likes" on public.community_post_likes;
create policy "Staff read community_post_likes"
  on public.community_post_likes for select
  to authenticated
  using (public.is_staff_community());

drop policy if exists "Staff insert own community_post_likes" on public.community_post_likes;
create policy "Staff insert own community_post_likes"
  on public.community_post_likes for insert
  to authenticated
  with check (
    public.is_staff_community()
    and user_id = auth.uid()
  );

drop policy if exists "Staff delete own community_post_likes" on public.community_post_likes;
create policy "Staff delete own community_post_likes"
  on public.community_post_likes for delete
  to authenticated
  using (
    public.is_staff_community()
    and user_id = auth.uid()
  );
