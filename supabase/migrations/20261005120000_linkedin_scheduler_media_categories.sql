-- Expand LinkedIn scheduled posts for media types, categories, and library drafts.

alter table public.linkedin_scheduled_posts
  alter column scheduled_for drop not null;

alter table public.linkedin_scheduled_posts
  drop constraint if exists linkedin_scheduled_posts_status_check;

alter table public.linkedin_scheduled_posts
  add constraint linkedin_scheduled_posts_status_check
  check (status in ('draft', 'scheduled', 'published', 'failed', 'cancelled'));

alter table public.linkedin_scheduled_posts
  add column if not exists post_type text not null default 'text';

alter table public.linkedin_scheduled_posts
  drop constraint if exists linkedin_scheduled_posts_post_type_check;

alter table public.linkedin_scheduled_posts
  add constraint linkedin_scheduled_posts_post_type_check
  check (post_type in ('text', 'image', 'multi_image', 'article'));

alter table public.linkedin_scheduled_posts
  add column if not exists category text null;

alter table public.linkedin_scheduled_posts
  add column if not exists article_url text null;

alter table public.linkedin_scheduled_posts
  add column if not exists media jsonb not null default '[]'::jsonb;

-- Drafts must not require a schedule; scheduled/published rows should have one.
alter table public.linkedin_scheduled_posts
  drop constraint if exists linkedin_scheduled_posts_schedule_consistency;

alter table public.linkedin_scheduled_posts
  add constraint linkedin_scheduled_posts_schedule_consistency
  check (
    (status = 'draft' and scheduled_for is null)
    or (
      status in ('scheduled', 'published', 'failed', 'cancelled')
      and scheduled_for is not null
    )
  );

create index if not exists linkedin_scheduled_posts_user_category_idx
  on public.linkedin_scheduled_posts (user_id, category);

create index if not exists linkedin_scheduled_posts_user_status_schedule_idx
  on public.linkedin_scheduled_posts (user_id, status, scheduled_for);

-- Private media bucket for LinkedIn composer uploads (service role + signed URLs).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'linkedin-media',
  'linkedin-media',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins can upload own linkedin media" on storage.objects;
create policy "Admins can upload own linkedin media"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'linkedin-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Admins can read own linkedin media" on storage.objects;
create policy "Admins can read own linkedin media"
on storage.objects for select
to authenticated
using (
  bucket_id = 'linkedin-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Admins can update own linkedin media" on storage.objects;
create policy "Admins can update own linkedin media"
on storage.objects for update
to authenticated
using (
  bucket_id = 'linkedin-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Admins can delete own linkedin media" on storage.objects;
create policy "Admins can delete own linkedin media"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'linkedin-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);
