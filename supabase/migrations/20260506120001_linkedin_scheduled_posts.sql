-- Queue for LinkedIn text posts (member profile posting).
create table if not exists linkedin_scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  content text not null,
  scheduled_for timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'published', 'failed', 'cancelled')),
  attempts int not null default 0,
  last_error text null,
  linkedin_post_urn text null,
  published_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists linkedin_scheduled_posts_user_idx
  on linkedin_scheduled_posts (user_id, scheduled_for desc);

create index if not exists linkedin_scheduled_posts_due_idx
  on linkedin_scheduled_posts (status, scheduled_for);

create or replace function set_linkedin_scheduled_posts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists linkedin_scheduled_posts_set_updated_at
  on linkedin_scheduled_posts;

create trigger linkedin_scheduled_posts_set_updated_at
before update on linkedin_scheduled_posts
for each row execute function set_linkedin_scheduled_posts_updated_at();
