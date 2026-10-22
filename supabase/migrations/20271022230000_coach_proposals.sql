-- Proposals: a digital proposal a coach writes for one prospect, filled from
-- their Blueprint, sent as a private link, tracked and signed online.

create table if not exists public.coach_proposals (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete set null,
  prospect_name text not null,
  prospect_business text,
  prospect_email text,
  title text,
  -- Ordered sections: [{ key, title, body, hidden }].
  sections jsonb not null default '[]'::jsonb,
  status text not null default 'draft',
  -- The prospect's private link.
  share_token text not null unique default encode(gen_random_bytes(18), 'hex'),
  sent_at timestamptz,
  sent_to text,
  first_opened_at timestamptz,
  last_opened_at timestamptz,
  open_count integer not null default 0,
  signed_at timestamptz,
  signed_name text,
  -- What they signed: the sections as they were at that moment.
  signed_snapshot jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coach_proposals_status_check
    check (status in ('draft', 'sent', 'opened', 'signed', 'archived'))
);

create index if not exists coach_proposals_coach_idx on public.coach_proposals (coach_id, updated_at desc);

alter table public.coach_proposals enable row level security;
-- Server only: coach APIs check the owner; the public page reads by token.

comment on table public.coach_proposals is
  'Digital proposals coaches send to prospects (Get Clients → Proposals).';
