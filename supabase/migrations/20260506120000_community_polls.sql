-- Community polls attached to posts.
-- Poll definition lives on community_posts.poll (jsonb) for atomic post creation.
-- Votes live in community_post_poll_votes (one vote per user per post).

alter table public.community_posts
  add column if not exists poll jsonb;

alter table public.community_posts
  add column if not exists feed_poll_vote_count integer not null default 0;

comment on column public.community_posts.poll is 'Optional poll config: { kind:"poll", options:[{id,text}] }.';
comment on column public.community_posts.feed_poll_vote_count is 'Denormalized count of distinct voters for the poll (0 if no poll).';

alter table public.community_posts
  drop constraint if exists community_posts_poll_shape;

alter table public.community_posts
  add constraint community_posts_poll_shape
  check (
    poll is null
    or (
      jsonb_typeof(poll) = 'object'
      and coalesce(poll->>'kind', '') = 'poll'
      and jsonb_typeof(poll->'options') = 'array'
      and jsonb_array_length(poll->'options') >= 2
      and jsonb_array_length(poll->'options') <= 10
    )
  );

create table if not exists public.community_post_poll_votes (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  voter_id uuid not null references public.profiles(id) on delete cascade,
  option_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (post_id, voter_id)
);

create index if not exists community_post_poll_votes_post_id_idx
  on public.community_post_poll_votes (post_id);

create index if not exists community_post_poll_votes_voter_id_idx
  on public.community_post_poll_votes (voter_id);

create or replace function public._community_post_poll_vote_stats_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  pid uuid;
begin
  pid := coalesce(new.post_id, old.post_id);
  update public.community_posts p
  set feed_poll_vote_count = (
    select count(*)::int
    from public.community_post_poll_votes v
    where v.post_id = pid
  )
  where p.id = pid;
  return coalesce(new, old);
end;
$fn$;

drop trigger if exists community_post_poll_votes_ins on public.community_post_poll_votes;
create trigger community_post_poll_votes_ins
  after insert on public.community_post_poll_votes
  for each row
  execute procedure public._community_post_poll_vote_stats_trigger();

drop trigger if exists community_post_poll_votes_del on public.community_post_poll_votes;
create trigger community_post_poll_votes_del
  after delete on public.community_post_poll_votes
  for each row
  execute procedure public._community_post_poll_vote_stats_trigger();

drop trigger if exists community_post_poll_votes_upd on public.community_post_poll_votes;
create trigger community_post_poll_votes_upd
  after update of option_id on public.community_post_poll_votes
  for each row
  execute procedure public._community_post_poll_vote_stats_trigger();

alter table public.community_post_poll_votes enable row level security;

drop policy if exists "Staff read community_post_poll_votes" on public.community_post_poll_votes;
create policy "Staff read community_post_poll_votes"
  on public.community_post_poll_votes for select
  to authenticated
  using (public.is_staff_community());

drop policy if exists "Staff insert own community_post_poll_votes" on public.community_post_poll_votes;
create policy "Staff insert own community_post_poll_votes"
  on public.community_post_poll_votes for insert
  to authenticated
  with check (public.is_staff_community() and voter_id = auth.uid());

drop policy if exists "Staff update own community_post_poll_votes" on public.community_post_poll_votes;
create policy "Staff update own community_post_poll_votes"
  on public.community_post_poll_votes for update
  to authenticated
  using (public.is_staff_community() and voter_id = auth.uid());

drop policy if exists "Staff delete own community_post_poll_votes" on public.community_post_poll_votes;
create policy "Staff delete own community_post_poll_votes"
  on public.community_post_poll_votes for delete
  to authenticated
  using (public.is_staff_community() and voter_id = auth.uid());

