-- One row per roadmap project, so Zander can steer projects rather than jobs:
-- a stage (Now, Next, Later, Parked), a one-line goal, the project's own impact
-- and ease, and a loose start and target week for the timeline. Jobs keep
-- their project as text (roadmap_jobs.project); this row adds the project's own fields.

create table if not exists public.roadmap_projects (
  name text primary key,
  stage text not null default 'next',
  goal text,
  impact smallint,
  ease smallint,
  start_on date,
  target_on date,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint roadmap_projects_stage_check check (stage in ('now', 'next', 'later', 'parked')),
  constraint roadmap_projects_impact_check check (impact is null or impact between 1 and 5),
  constraint roadmap_projects_ease_check check (ease is null or ease between 1 and 5)
);

alter table public.roadmap_projects enable row level security;
-- Admin API only.

-- Draft stages and goals (23 Oct) for Zander to reorder. Dates only for Now projects.
insert into public.roadmap_projects (name, stage, goal, impact, ease, start_on, target_on, sort_order) values
  ('Blueprint', 'now', 'BCA writes the whole practice from About You', 5, 3, '2026-10-19', '2026-11-06', 1),
  ('Onboarding', 'now', 'A new coach knows exactly what to do in their first week', 5, 2, '2026-10-26', '2026-11-20', 2),
  ('Get Clients engine', 'now', 'Campaigns turn into booked calls for every coach', 5, 3, '2026-10-19', '2026-11-13', 3),
  ('Booking', 'now', 'Every call links back to the campaign it came from', 4, 4, '2026-10-22', '2026-10-30', 4),
  ('Scripts & BOSS Review', 'next', 'Coaches run the BOSS Score Review and close with the scripts', 5, 3, null, null, 5),
  ('Ava', 'next', 'One Ava, in a voice coaches trust, who nudges and drafts for them', 4, 3, null, null, 6),
  ('Classroom', 'next', 'The Classroom teaches only what the coach does; BCA does the rest', 4, 2, null, null, 7),
  ('Content', 'next', 'Coaches post and send newsletters without writing from scratch', 3, 3, null, null, 8),
  ('Cold email', 'next', 'A second outbound channel beside LinkedIn', 4, 2, null, null, 9),
  ('Ship & ops', 'next', 'Shipping and the roadmap run smoothly', 3, 4, null, null, 10),
  ('Keep Clients', 'later', 'Coaches run their clients'' coaching in the app', 3, 3, null, null, 11),
  ('Billing', 'later', 'Members see their real plan and can upgrade', 4, 2, null, null, 12),
  ('Brand & websites', 'later', 'One brand canon; coach websites from the Blueprint', 3, 3, null, null, 13),
  ('Community', 'later', 'Members help each other and stay', 2, 4, null, null, 14),
  ('Library', 'later', 'Books and talks in the Vault', 2, 4, null, null, 15),
  ('Proposals', 'parked', 'Explainer, proposal, sign online, welcome pack', 4, 3, null, null, 16)
on conflict (name) do nothing;
