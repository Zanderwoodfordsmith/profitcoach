-- Links and files on a community calendar session (workbooks, the announcement
-- post, links shared in the Zoom chat). occurrence_start is set for one date of
-- a recurring series; null means the whole (one-off) event.

create table if not exists public.community_calendar_event_links (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.community_calendar_events (id) on delete cascade,
  occurrence_start timestamptz,
  label text not null default '' check (char_length(label) <= 200),
  url text not null check (url ~* '^https?://' and char_length(url) <= 2000),
  source text not null default 'manual' check (source in ('manual', 'upload', 'zoom_chat')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists community_calendar_event_links_event_idx
  on public.community_calendar_event_links (event_id, occurrence_start);

-- Same link never added twice to the same session (Zoom webhook can retry).
create unique index if not exists community_calendar_event_links_unique
  on public.community_calendar_event_links (
    event_id,
    coalesce(occurrence_start, 'epoch'::timestamptz),
    url
  );

alter table public.community_calendar_event_links enable row level security;

drop policy if exists "Staff read community_calendar_event_links" on public.community_calendar_event_links;
create policy "Staff read community_calendar_event_links"
  on public.community_calendar_event_links for select
  to authenticated
  using (
    exists (
      select 1 from public.community_calendar_events e
      where e.id = community_calendar_event_links.event_id
        and public.staff_can_read_calendar_event(e.access_tags)
    )
  );

drop policy if exists "Admin insert community_calendar_event_links" on public.community_calendar_event_links;
create policy "Admin insert community_calendar_event_links"
  on public.community_calendar_event_links for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Admin delete community_calendar_event_links" on public.community_calendar_event_links;
create policy "Admin delete community_calendar_event_links"
  on public.community_calendar_event_links for delete
  to authenticated
  using (public.is_admin());
