-- Content → Settings (headline, website, quote handle) for every coach,
-- however their LinkedIn is connected. Before this, coaches on Unipile could
-- press Save and nothing was stored.
create table if not exists public.linkedin_composer_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  display_headline text,
  website_label text,
  website_url text,
  quote_handle text,
  updated_at timestamptz not null default now()
);

alter table public.linkedin_composer_settings enable row level security;
-- Server only (the Content API checks the coach).

-- Carry over what coaches on the older connection already saved.
insert into public.linkedin_composer_settings (user_id, display_headline, website_label, website_url, quote_handle)
select user_id, display_headline, website_label, website_url, quote_handle
from public.linkedin_member_connections
where coalesce(display_headline, website_label, website_url, quote_handle) is not null
on conflict (user_id) do nothing;
