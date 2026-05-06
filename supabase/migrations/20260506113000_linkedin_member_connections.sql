-- Store LinkedIn OAuth connections for member (personal profile) posting.
create table if not exists linkedin_member_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  linkedin_sub text not null,
  access_token text not null,
  scope text[] not null default '{}',
  token_expires_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists linkedin_member_connections_sub_idx
  on linkedin_member_connections (linkedin_sub);

create or replace function set_linkedin_member_connections_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists linkedin_member_connections_set_updated_at
  on linkedin_member_connections;

create trigger linkedin_member_connections_set_updated_at
before update on linkedin_member_connections
for each row execute function set_linkedin_member_connections_updated_at();
