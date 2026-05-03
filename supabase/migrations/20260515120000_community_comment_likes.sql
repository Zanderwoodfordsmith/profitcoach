-- Comment likes (staff community): one like per user per comment

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
