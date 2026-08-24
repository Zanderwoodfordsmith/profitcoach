-- Reference images on roadmap jobs (design refs, screenshots) so a builder
-- picking up the job has the visuals. Shape: images [{id, path, url, name, created_at}].
-- Files live in the public roadmap-images bucket; uploads/deletes go through
-- the admin API only (service role), so no authenticated write policies needed.

alter table public.roadmap_jobs
  add column if not exists images jsonb not null default '[]'::jsonb;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'roadmap-images',
  'roadmap-images',
  true,
  10485760, -- 10MB per image
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
