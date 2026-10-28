-- Ava finds things and remembers. Additive only.
--
-- 1. Name search that matches each word on its own, word starts ("pam" finds
--    "Pamela") and small spelling slips (trigram similarity). The app expands
--    short names (Pam|Pamela) into groups before calling these.
-- 2. ava_memory: one dated row per summary, fact or raw chunk of a coach's
--    history (Ava chats, call transcripts, LinkedIn posts), searched by
--    keyword twice (summaries, raw text), fused, with newer items ahead.

create extension if not exists pg_trgm with schema extensions;
-- Load pg_trgm in this session, so ava_search_people may set its similarity threshold.
select extensions.word_similarity('a', 'a');

-- ---------------------------------------------------------------------------
-- Scoring (inline in each search, set-based for speed): p_groups is one entry
-- per query word, alternatives joined by "|" ("pamela|pam", "woodford"). A
-- group scores 1 when a word in the text starts with one of its alternatives,
-- else its best trigram word similarity. A row's score is the average over
-- groups, so 1 means every word matched. Rows under 0.5 are dropped.
-- ---------------------------------------------------------------------------

-- The text a person is matched on: lowercase words separated by single spaces,
-- with a leading space so " pam" finds a word start. Immutable so the people
-- tables can carry a trigram index on it: the index finds the few rows near a
-- query word, and only those are scored.
create or replace function public.ava_name_text(variadic parts text[])
returns text
language sql
immutable
parallel safe
as $$
  select ' ' || btrim(regexp_replace(lower(array_to_string(parts, ' ')), '[^a-z0-9]+', ' ', 'g'))
$$;

create index if not exists coach_lead_list_items_ava_name_trgm_idx on public.coach_lead_list_items
  using gin (public.ava_name_text(full_name, first_name, last_name, company, job_title) extensions.gin_trgm_ops);
create index if not exists linkedin_campaign_leads_ava_name_trgm_idx on public.linkedin_campaign_leads
  using gin (public.ava_name_text(first_name, last_name, company, title) extensions.gin_trgm_ops);
create index if not exists contacts_ava_name_trgm_idx on public.contacts
  using gin (public.ava_name_text(full_name, first_name, last_name, business_name, job_title, email) extensions.gin_trgm_ops);
create index if not exists messaging_conversations_ava_person_trgm_idx on public.messaging_conversations
  using gin (public.ava_name_text(prospect_name, prospect_business_name, prospect_email) extensions.gin_trgm_ops);

-- Coaches (admin Ava): name, first and last name, business.
create or replace function public.ava_search_coaches(p_groups text[], p_limit int default 8)
returns table (
  id uuid,
  full_name text,
  business text,
  membership_status text,
  agent_enabled boolean,
  score real
)
language sql
stable
set search_path = public, extensions
as $$
  with words as (
    select g.n, a.alt, ' ' || a.alt as pre
    from unnest(p_groups) with ordinality as g(grp, n)
    cross join lateral unnest(string_to_array(g.grp, '|')) as a(alt)
    where a.alt <> ''
  ),
  cands as (
    select p.id, p.full_name, p.coach_business_name, c.membership_status,
           coalesce(c.ai_agent_enabled, false) as agent_enabled,
           public.ava_name_text(p.full_name, p.first_name, p.last_name, p.coach_business_name) as txt
    from public.profiles p
    join public.coaches c on c.id = p.id
    where p.role in ('coach', 'admin')
  ),
  per_group as (
    select r.id, w.n,
           max(case when strpos(r.txt, w.pre) > 0 then 1 else extensions.word_similarity(w.alt, r.txt) end) as best
    from cands r cross join words w
    group by r.id, w.n
  ),
  scored as (
    select id, (sum(best) / (select count(distinct n) from words))::real as score
    from per_group group by id
  )
  select r.id, r.full_name, r.coach_business_name, r.membership_status, r.agent_enabled, s.score
  from scored s join cands r on r.id = s.id
  where s.score >= 0.5
  order by s.score desc, r.full_name
  limit greatest(1, least(coalesce(p_limit, 8), 50));
$$;

-- One coach's people: list members, campaign people, contacts, conversations.
-- p_list_id / p_campaign_id narrow it to one list or campaign.
create or replace function public.ava_search_people(
  p_coach_id uuid,
  p_groups text[],
  p_list_id uuid default null,
  p_campaign_id uuid default null,
  p_limit int default 20
)
returns table (
  kind text,
  id uuid,
  name text,
  company text,
  title text,
  place text,
  place_id uuid,
  status text,
  score real
)
language sql
stable
set search_path = public, extensions
-- Candidates: rows whose text has a word at least this close to a query word.
set pg_trgm.word_similarity_threshold = 0.45
as $$
  with words as (
    select g.n, a.alt, ' ' || a.alt as pre
    from unnest(p_groups) with ordinality as g(grp, n)
    cross join lateral unnest(string_to_array(g.grp, '|')) as a(alt)
    where a.alt <> ''
  ),
  people as (
    select 'list_person'::text as kind, i.id,
           coalesce(nullif(i.full_name, ''), concat_ws(' ', i.first_name, i.last_name)) as name,
           i.company, i.job_title as title, l.name as place, l.id as place_id, null::text as status,
           public.ava_name_text(i.full_name, i.first_name, i.last_name, i.company, i.job_title) as txt
    from public.coach_lead_list_items i
    join public.coach_lead_lists l on l.id = i.list_id
    where i.coach_id = p_coach_id
      and p_campaign_id is null
      and (p_list_id is null or i.list_id = p_list_id)
      and public.ava_name_text(i.full_name, i.first_name, i.last_name, i.company, i.job_title)
          %> any (string_to_array(array_to_string(p_groups, '|'), '|'))
    union all
    select 'campaign_person', cl.id, concat_ws(' ', cl.first_name, cl.last_name),
           cl.company, cl.title, c.name, c.id, coalesce(cl.status, 'queued'),
           public.ava_name_text(cl.first_name, cl.last_name, cl.company, cl.title)
    from public.linkedin_campaign_leads cl
    join public.linkedin_campaigns c on c.id = cl.campaign_id
    where cl.coach_id = p_coach_id
      and p_list_id is null
      and (p_campaign_id is null or cl.campaign_id = p_campaign_id)
      and public.ava_name_text(cl.first_name, cl.last_name, cl.company, cl.title)
          %> any (string_to_array(array_to_string(p_groups, '|'), '|'))
    union all
    select 'contact', ct.id,
           coalesce(nullif(ct.full_name, ''), concat_ws(' ', ct.first_name, ct.last_name)),
           ct.business_name, ct.job_title, null, null, coalesce(ct.prospect_status, ct.type::text),
           public.ava_name_text(ct.full_name, ct.first_name, ct.last_name, ct.business_name, ct.job_title, ct.email)
    from public.contacts ct
    where ct.coach_id = p_coach_id and p_list_id is null and p_campaign_id is null
      and public.ava_name_text(ct.full_name, ct.first_name, ct.last_name, ct.business_name, ct.job_title, ct.email)
          %> any (string_to_array(array_to_string(p_groups, '|'), '|'))
    union all
    select 'conversation', mc.id, mc.prospect_name, mc.prospect_business_name, null, null, null,
           to_char(mc.last_message_at, 'YYYY-MM-DD'),
           public.ava_name_text(mc.prospect_name, mc.prospect_business_name, mc.prospect_email)
    from public.messaging_conversations mc
    where mc.coach_id = p_coach_id and mc.hidden_at is null
      and p_list_id is null and p_campaign_id is null
      and public.ava_name_text(mc.prospect_name, mc.prospect_business_name, mc.prospect_email)
          %> any (string_to_array(array_to_string(p_groups, '|'), '|'))
  ),
  per_group as (
    select r.kind, r.id, w.n,
           max(case when strpos(r.txt, w.pre) > 0 then 1 else extensions.word_similarity(w.alt, r.txt) end) as best
    from people r cross join words w
    group by r.kind, r.id, w.n
  ),
  scored as (
    select kind, id, (sum(best) / (select count(distinct n) from words))::real as score
    from per_group group by kind, id
  )
  select p.kind, p.id, p.name, p.company, p.title, p.place, p.place_id, p.status, s.score
  from scored s
  join people p on p.kind = s.kind and p.id = s.id
  where s.score >= 0.5
  -- On a tie, words found in the name beat words found in the company or email.
  order by s.score desc,
           (select count(*) from words w where strpos(public.ava_name_text(p.name), w.pre) > 0) desc,
           p.name
  limit greatest(1, least(coalesce(p_limit, 20), 200));
$$;

-- ---------------------------------------------------------------------------
-- Memory
-- ---------------------------------------------------------------------------
create table if not exists public.ava_memory (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  -- 'admin': only admin Ava sees it (BCA's own chats and calls about the coach).
  audience text not null default 'coach' check (audience in ('coach', 'admin')),
  -- ava_chat, sales_call, zoom_call, linkedin_post, newsletter
  source text not null,
  source_id text not null,
  -- item: a short thing whole, or a long thing's header. segment: one topic
  -- with the question that finds it. atom: one exact fact. raw: 4,000-char chunk.
  kind text not null check (kind in ('item', 'segment', 'atom', 'raw')),
  ts timestamptz not null,
  title text not null default '',
  content text not null default '',
  -- Where the original lives in the app, when it has a page.
  url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  search_tsv tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A')
    || setweight(to_tsvector('english', coalesce(content, '')), 'B')
  ) stored
);

create index if not exists ava_memory_search_tsv_idx on public.ava_memory using gin (search_tsv);
create index if not exists ava_memory_item_idx on public.ava_memory (coach_id, source, source_id);

-- One watermark per connector: what it has already taken in.
create table if not exists public.ava_memory_state (
  source text primary key,
  watermark text,
  last_run_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);

alter table public.ava_memory enable row level security;
alter table public.ava_memory_state enable row level security;
revoke all on public.ava_memory from anon, authenticated;
revoke all on public.ava_memory_state from anon, authenticated;
grant all on public.ava_memory to service_role;
grant all on public.ava_memory_state to service_role;

-- Keyword search run twice (summaries and short items; raw chunks), fused per
-- source item with reciprocal rank fusion (k=60, raw weighted 0.5). Then:
-- coverage (the share of query words the item contains) so "cash flow" beats
-- "flow"; and a small recency factor, so of two equal matches the newer wins.
-- p_groups: one entry per query word, alternatives joined by "|" (as for
-- people); the app keeps them to plain lowercase letters and digits.
drop function if exists public.ava_memory_search(uuid, text[], boolean, timestamptz, text, int);
create or replace function public.ava_memory_search(
  p_coach_id uuid,
  p_groups text[],
  p_include_admin boolean,
  p_after timestamptz default null,
  p_source text default null,
  p_limit int default 8
)
returns table (
  source text,
  source_id text,
  ts timestamptz,
  title text,
  summary_snippet text,
  raw_snippet text,
  url text,
  score double precision
)
language sql
stable
set search_path = public, extensions
as $$
  with q as (
    select to_tsquery('english', replace(array_to_string(p_groups, '|'), '|', ' | ')) as tsq
  ),
  group_q as (
    select to_tsquery('english', replace(g, '|', ' | ')) as gq from unnest(p_groups) as g
  ),
  base as (
    select m.id, m.source, m.source_id, m.kind, m.ts, m.title, m.content, m.url, m.search_tsv,
           ts_rank_cd(m.search_tsv, q.tsq) as rank
    from public.ava_memory m, q
    where m.coach_id = p_coach_id
      and (p_include_admin or m.audience = 'coach')
      and (p_after is null or m.ts >= p_after)
      and (p_source is null or m.source = p_source)
      and m.search_tsv @@ q.tsq
  ),
  s_hits as (
    select b.*, row_number() over (order by b.rank desc) as rn
    from base b where b.kind <> 'raw' order by b.rank desc limit 60
  ),
  r_hits as (
    select b.*, row_number() over (order by b.rank desc) as rn
    from base b where b.kind = 'raw' order by b.rank desc limit 60
  ),
  hits as (
    select h.*, 1.0 as w from s_hits h
    union all
    select h.*, 0.5 from r_hits h
  ),
  fused as (
    select x.source, x.source_id, sum(x.w / (60.0 + x.rn)) as rrf, max(x.ts) as ts, max(x.coverage) as coverage
    from (
      select h.source, h.source_id, h.w, min(h.rn) as rn, max(h.ts) as ts,
             max((select count(*) from group_q where h.search_tsv @@ group_q.gq)) as coverage
      from hits h
      group by h.source, h.source_id, h.w
    ) x
    group by 1, 2
  )
  select f.source, f.source_id, f.ts,
         coalesce(bs.title, br.title),
         case when bs.content is not null then ts_headline('english', bs.content, q.tsq,
           'StartSel=«, StopSel=», MaxWords=45, MinWords=15, MaxFragments=2, FragmentDelimiter= … ') end,
         case when br.content is not null then ts_headline('english', br.content, q.tsq,
           'StartSel=«, StopSel=», MaxWords=45, MinWords=15, MaxFragments=2, FragmentDelimiter= … ') end,
         coalesce(bs.url, br.url),
         f.rrf
           * (0.5 + 0.5 * f.coverage / greatest(1, cardinality(p_groups)))
           * (0.8 + 0.2 * exp(-greatest(0, extract(epoch from now() - f.ts) / 86400.0) / 180.0))
  from fused f
  cross join q
  left join lateral (
    select s.title, s.content, s.url from s_hits s
    where s.source = f.source and s.source_id = f.source_id order by s.rn limit 1
  ) bs on true
  left join lateral (
    select r.title, r.content, r.url from r_hits r
    where r.source = f.source and r.source_id = f.source_id order by r.rn limit 1
  ) br on true
  order by 8 desc
  limit greatest(1, least(coalesce(p_limit, 8), 30));
$$;

revoke all on function public.ava_name_text(text[]) from public, anon, authenticated;
revoke all on function public.ava_search_coaches(text[], int) from public, anon, authenticated;
revoke all on function public.ava_search_people(uuid, text[], uuid, uuid, int) from public, anon, authenticated;
revoke all on function public.ava_memory_search(uuid, text[], boolean, timestamptz, text, int) from public, anon, authenticated;
grant execute on function public.ava_name_text(text[]) to service_role;
grant execute on function public.ava_search_coaches(text[], int) to service_role;
grant execute on function public.ava_search_people(uuid, text[], uuid, uuid, int) to service_role;
grant execute on function public.ava_memory_search(uuid, text[], boolean, timestamptz, text, int) to service_role;
