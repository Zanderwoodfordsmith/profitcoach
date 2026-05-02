-- Community feed (coach/admin only): categories, posts, one-level comments

-- Categories
create table if not exists community_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  sort_order int not null default 0
);

insert into community_categories (slug, label, sort_order) values
  ('general', 'General', 1),
  ('wins', 'Wins', 2),
  ('announcements', 'Announcements', 3),
  ('technical', 'Technical', 4),
  ('resources', 'Resources', 5)
on conflict (slug) do nothing;

-- Posts
create table if not exists community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references profiles(id) on delete cascade,
  category_id uuid not null references community_categories(id),
  title text not null,
  body text not null default '',
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists community_posts_created_at_idx on community_posts (created_at desc);
create index if not exists community_posts_category_id_idx on community_posts (category_id);
create index if not exists community_posts_pinned_created_idx on community_posts (is_pinned desc, created_at desc);

-- Comments (parent_comment_id null = top-level; else reply to top-level only)
create table if not exists community_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references community_posts(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  body text not null default '',
  parent_comment_id uuid references community_post_comments(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists community_post_comments_post_id_idx on community_post_comments (post_id, created_at);
create index if not exists community_post_comments_parent_idx on community_post_comments (parent_comment_id);

create or replace function community_comment_parent_must_be_top_level()
returns trigger
language plpgsql
as $fn$
begin
  if new.parent_comment_id is not null then
    if not exists (
      select 1 from community_post_comments parent
      where parent.id = new.parent_comment_id
        and parent.parent_comment_id is null
        and parent.post_id = new.post_id
    ) then
      raise exception 'Replies must target a top-level comment on the same post';
    end if;
  end if;
  return new;
end;
$fn$;

drop trigger if exists community_comment_depth_check on community_post_comments;
create trigger community_comment_depth_check
  before insert or update on community_post_comments
  for each row
  execute procedure community_comment_parent_must_be_top_level();

-- RLS helper: current user is staff (coach or admin)
create or replace function public.is_staff_community()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles p
    where p.id = auth.uid()
      and p.role in ('coach', 'admin')
  );
$$;

alter table community_categories enable row level security;
alter table community_posts enable row level security;
alter table community_post_comments enable row level security;

-- Categories: staff read
drop policy if exists "Staff read community_categories" on community_categories;
create policy "Staff read community_categories"
  on community_categories for select
  to authenticated
  using (public.is_staff_community());

-- Posts
drop policy if exists "Staff read community_posts" on community_posts;
create policy "Staff read community_posts"
  on community_posts for select
  to authenticated
  using (public.is_staff_community());

drop policy if exists "Staff insert own community_posts" on community_posts;
create policy "Staff insert own community_posts"
  on community_posts for insert
  to authenticated
  with check (public.is_staff_community() and author_id = auth.uid());

drop policy if exists "Staff update community_posts" on community_posts;
create policy "Staff update community_posts"
  on community_posts for update
  to authenticated
  using (
    public.is_staff_community()
    and (
      author_id = auth.uid()
      or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
    )
  );

drop policy if exists "Staff delete community_posts" on community_posts;
create policy "Staff delete community_posts"
  on community_posts for delete
  to authenticated
  using (
    public.is_staff_community()
    and (
      author_id = auth.uid()
      or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
    )
  );

-- Comments
drop policy if exists "Staff read community_post_comments" on community_post_comments;
create policy "Staff read community_post_comments"
  on community_post_comments for select
  to authenticated
  using (public.is_staff_community());

drop policy if exists "Staff insert community_post_comments" on community_post_comments;
create policy "Staff insert community_post_comments"
  on community_post_comments for insert
  to authenticated
  with check (
    public.is_staff_community()
    and author_id = auth.uid()
  );

drop policy if exists "Staff update community_post_comments" on community_post_comments;
create policy "Staff update community_post_comments"
  on community_post_comments for update
  to authenticated
  using (
    public.is_staff_community()
    and (
      author_id = auth.uid()
      or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
    )
  );

drop policy if exists "Staff delete community_post_comments" on community_post_comments;
create policy "Staff delete community_post_comments"
  on community_post_comments for delete
  to authenticated
  using (
    public.is_staff_community()
    and (
      author_id = auth.uid()
      or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
    )
  );

-- Allow staff to read basic fields on other staff profiles (for author names in community)
drop policy if exists "Staff read staff profiles for community" on profiles;
create policy "Staff read staff profiles for community"
  on profiles for select
  to authenticated
  using (
    public.is_staff_community()
    and role in ('coach', 'admin')
  );
