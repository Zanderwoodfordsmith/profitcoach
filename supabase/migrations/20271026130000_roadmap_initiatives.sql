-- Initiatives sit above projects (like Linear: initiatives, projects, jobs).
-- One row per initiative; each project can belong to one. Additive only.

create table if not exists public.roadmap_initiatives (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  goal text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.roadmap_initiatives enable row level security;
-- Admin API only.

alter table public.roadmap_projects
  add column if not exists initiative_id uuid references public.roadmap_initiatives (id) on delete set null;

-- Draft initiatives (26 Oct) for Zander to rename and reshuffle.
do $$
declare
  win uuid;
  build uuid;
  keep uuid;
  app uuid;
begin
  if exists (select 1 from public.roadmap_initiatives) then
    return;
  end if;
  insert into public.roadmap_initiatives (name, goal, sort_order)
    values ('New coaches win clients fast', 'A new coach books their first paying client within weeks', 1)
    returning id into win;
  insert into public.roadmap_initiatives (name, goal, sort_order)
    values ('BCA builds the practice for them', 'BCA writes and sets up each coach''s practice', 2)
    returning id into build;
  insert into public.roadmap_initiatives (name, goal, sort_order)
    values ('Coaches keep clients and stay', 'Coaches deliver well, keep their clients and stay with BCA', 3)
    returning id into keep;
  insert into public.roadmap_initiatives (name, goal, sort_order)
    values ('The app and how we ship', 'Ava, billing and shipping run smoothly', 4)
    returning id into app;

  update public.roadmap_projects set initiative_id = win
    where name in ('Get Clients engine', 'Booking', 'Scripts & BOSS Review', 'Cold email', 'Content', 'Onboarding');
  update public.roadmap_projects set initiative_id = build
    where name in ('Blueprint', 'Brand & websites', 'Proposals');
  update public.roadmap_projects set initiative_id = keep
    where name in ('Keep Clients', 'Classroom', 'Community', 'Library');
  update public.roadmap_projects set initiative_id = app
    where name in ('Ava', 'Billing', 'Ship & ops');
end $$;
