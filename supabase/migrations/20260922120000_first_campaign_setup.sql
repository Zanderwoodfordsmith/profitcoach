-- First Campaign Setup: wizard state, ICPs, avatars, messages, lead lists,
-- LinkedIn connections uploads, and curated ICP avatar library.

-- ---------------------------------------------------------------------------
-- Wizard state (one row per coach)
-- ---------------------------------------------------------------------------
create table if not exists public.coach_campaign_setup (
  coach_id uuid primary key references public.profiles (id) on delete cascade,
  current_step smallint not null default 1 check (current_step between 1 and 5),
  step1_completed_at timestamptz,
  step2_completed_at timestamptz,
  step3_completed_at timestamptz,
  step4_completed_at timestamptz,
  step5_completed_at timestamptz,
  selected_icp_id uuid,
  selected_avatar_id uuid,
  selected_lead_list_id uuid,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Ideal client profiles (market definition)
-- ---------------------------------------------------------------------------
create table if not exists public.coach_icps (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  label text not null,
  industry text not null default '',
  geography text not null default 'United Kingdom',
  role_titles text[] not null default array['Owner','Founder','CEO','Managing Director']::text[],
  team_size text not null default '11-50',
  revenue_range text not null default '£1M-£10M',
  sourcing_route text not null default 'strong'
    check (sourcing_route in ('strong', 'thin', 'none')),
  inventory_count integer,
  lead_finder_filters jsonb not null default '{}'::jsonb,
  profile_payload jsonb not null default '{}'::jsonb,
  is_selected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists coach_icps_coach_id_idx on public.coach_icps (coach_id);

alter table public.coach_campaign_setup
  drop constraint if exists coach_campaign_setup_selected_icp_id_fkey;
alter table public.coach_campaign_setup
  add constraint coach_campaign_setup_selected_icp_id_fkey
  foreign key (selected_icp_id) references public.coach_icps (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Avatars (persona + triggers)
-- ---------------------------------------------------------------------------
create table if not exists public.coach_avatars (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  icp_id uuid references public.coach_icps (id) on delete set null,
  library_id uuid,
  generated_payload jsonb not null default '{}'::jsonb,
  edited_payload jsonb,
  approved_at timestamptz,
  brain_saved_keys text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists coach_avatars_coach_id_idx on public.coach_avatars (coach_id);

alter table public.coach_campaign_setup
  drop constraint if exists coach_campaign_setup_selected_avatar_id_fkey;
alter table public.coach_campaign_setup
  add constraint coach_campaign_setup_selected_avatar_id_fkey
  foreign key (selected_avatar_id) references public.coach_avatars (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Campaign messages
-- ---------------------------------------------------------------------------
create table if not exists public.coach_campaign_messages (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  icp_id uuid references public.coach_icps (id) on delete set null,
  variant_label text not null,
  message_type text not null check (message_type in ('connector', 'follow_up')),
  body text not null,
  tokens jsonb not null default '{}'::jsonb,
  approved_at timestamptz,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists coach_campaign_messages_coach_id_idx
  on public.coach_campaign_messages (coach_id);

-- ---------------------------------------------------------------------------
-- Lead lists
-- ---------------------------------------------------------------------------
create table if not exists public.coach_lead_lists (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  source text not null check (source in ('lead_finder', 'connections', 'sales_nav_csv', 'mixed')),
  icp_id uuid references public.coach_icps (id) on delete set null,
  item_count integer not null default 0,
  filters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.coach_lead_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.coach_lead_lists (id) on delete cascade,
  coach_id uuid not null references public.profiles (id) on delete cascade,
  source text not null check (source in ('lead_finder', 'connections', 'sales_nav_csv')),
  leadrocks_id uuid,
  full_name text,
  first_name text,
  last_name text,
  job_title text,
  company text,
  linkedin_url text,
  email text,
  phone text,
  team_size text,
  revenue_range text,
  industry text,
  match_reason text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists coach_lead_list_items_list_id_idx
  on public.coach_lead_list_items (list_id);
create index if not exists coach_lead_list_items_coach_id_idx
  on public.coach_lead_list_items (coach_id);
create index if not exists coach_lead_list_items_linkedin_url_idx
  on public.coach_lead_list_items (linkedin_url);

alter table public.coach_campaign_setup
  drop constraint if exists coach_campaign_setup_selected_lead_list_id_fkey;
alter table public.coach_campaign_setup
  add constraint coach_campaign_setup_selected_lead_list_id_fkey
  foreign key (selected_lead_list_id) references public.coach_lead_lists (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Uploaded LinkedIn connections
-- ---------------------------------------------------------------------------
create table if not exists public.coach_linkedin_connections (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  upload_batch_id uuid not null,
  first_name text,
  last_name text,
  linkedin_url text,
  email text,
  company text,
  position text,
  connected_on text,
  title_match boolean not null default false,
  matched_titles text[] not null default '{}'::text[],
  enrich_status text not null default 'none'
    check (enrich_status in ('none', 'leadrocks', 'apify', 'failed')),
  team_size text,
  revenue_range text,
  industry text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists coach_linkedin_connections_coach_id_idx
  on public.coach_linkedin_connections (coach_id);
create index if not exists coach_linkedin_connections_batch_idx
  on public.coach_linkedin_connections (upload_batch_id);
create index if not exists coach_linkedin_connections_url_idx
  on public.coach_linkedin_connections (linkedin_url);
create index if not exists coach_linkedin_connections_title_match_idx
  on public.coach_linkedin_connections (coach_id, title_match)
  where title_match = true;

-- ---------------------------------------------------------------------------
-- Curated industry library (readable by all coaches)
-- ---------------------------------------------------------------------------
create table if not exists public.icp_avatar_library (
  id uuid primary key default gen_random_uuid(),
  industry_key text not null,
  industry_label text not null,
  depth text not null default 'light' check (depth in ('deep', 'light')),
  confidence text not null default 'medium' check (confidence in ('high', 'medium', 'low')),
  role_titles text[] not null default array['Owner','Founder','CEO','Managing Director']::text[],
  team_size text not null default '11-50',
  revenue_range text not null default '£1M-£10M',
  geography text not null default 'United Kingdom',
  vocabulary jsonb not null default '{}'::jsonb,
  universal_pains text[] not null default '{}'::text[],
  industry_pains text[] not null default '{}'::text[],
  main_desires text[] not null default '{}'::text[],
  objections text[] not null default '{}'::text[],
  buying_triggers text[] not null default '{}'::text[],
  exemplar_payload jsonb not null default '{}'::jsonb,
  source_files text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (industry_key)
);

alter table public.coach_avatars
  drop constraint if exists coach_avatars_library_id_fkey;
alter table public.coach_avatars
  add constraint coach_avatars_library_id_fkey
  foreign key (library_id) references public.icp_avatar_library (id) on delete set null;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.coach_campaign_setup enable row level security;
alter table public.coach_icps enable row level security;
alter table public.coach_avatars enable row level security;
alter table public.coach_campaign_messages enable row level security;
alter table public.coach_lead_lists enable row level security;
alter table public.coach_lead_list_items enable row level security;
alter table public.coach_linkedin_connections enable row level security;
alter table public.icp_avatar_library enable row level security;

-- Helper: coach owns row OR admin
-- Inline policies for each table

do $$
declare
  t text;
begin
  foreach t in array array[
    'coach_campaign_setup',
    'coach_icps',
    'coach_avatars',
    'coach_campaign_messages',
    'coach_lead_lists',
    'coach_lead_list_items',
    'coach_linkedin_connections'
  ]
  loop
    execute format('drop policy if exists "Coaches select own %s" on public.%I', t, t);
    execute format(
      'create policy "Coaches select own %s" on public.%I for select to authenticated using (coach_id = auth.uid())',
      t, t
    );
    execute format('drop policy if exists "Coaches insert own %s" on public.%I', t, t);
    execute format(
      'create policy "Coaches insert own %s" on public.%I for insert to authenticated with check (coach_id = auth.uid())',
      t, t
    );
    execute format('drop policy if exists "Coaches update own %s" on public.%I', t, t);
    execute format(
      'create policy "Coaches update own %s" on public.%I for update to authenticated using (coach_id = auth.uid()) with check (coach_id = auth.uid())',
      t, t
    );
    execute format('drop policy if exists "Coaches delete own %s" on public.%I', t, t);
    execute format(
      'create policy "Coaches delete own %s" on public.%I for delete to authenticated using (coach_id = auth.uid())',
      t, t
    );
    execute format('drop policy if exists "Admins all %s" on public.%I', t, t);
    execute format(
      'create policy "Admins all %s" on public.%I for all to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = ''admin'')) with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = ''admin''))',
      t, t
    );
  end loop;
end $$;

drop policy if exists "Coaches read icp avatar library" on public.icp_avatar_library;
create policy "Coaches read icp avatar library"
  on public.icp_avatar_library
  for select
  to authenticated
  using (true);

drop policy if exists "Admins write icp avatar library" on public.icp_avatar_library;
create policy "Admins write icp avatar library"
  on public.icp_avatar_library
  for all
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

comment on table public.coach_campaign_setup is 'First Campaign Setup wizard state per coach';
comment on table public.icp_avatar_library is 'Curated industry ICP/avatar templates seeded from BCA corpus';
