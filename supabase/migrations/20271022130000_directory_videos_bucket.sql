-- Intro videos on coach directory pages. Public to watch; uploads go through
-- signed upload URLs minted by /api/coach/directory/video for the page's coach.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'directory-videos',
  'directory-videos',
  true,
  314572800,
  array['video/mp4', 'video/quicktime', 'video/webm']
)
on conflict (id) do nothing;
