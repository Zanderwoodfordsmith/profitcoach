-- Community post scheduling support.
-- `published_at` controls when a post becomes visible in feeds.

alter table public.community_posts
  add column if not exists published_at timestamptz;

update public.community_posts
set published_at = coalesce(published_at, created_at, now())
where published_at is null;

alter table public.community_posts
  alter column published_at set not null,
  alter column published_at set default now();

create index if not exists community_posts_published_at_idx
  on public.community_posts (published_at desc);

create index if not exists community_posts_pinned_published_idx
  on public.community_posts (is_pinned desc, published_at desc, created_at desc);

drop policy if exists "Staff read community_posts" on public.community_posts;
create policy "Staff read community_posts"
  on public.community_posts
  for select
  to authenticated
  using (
    public.is_staff_community()
    and (
      published_at <= now()
      or exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.role = 'admin'
      )
    )
  );
