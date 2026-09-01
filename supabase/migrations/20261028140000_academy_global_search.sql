-- Global academy search: weighted FTS indexes + RPCs for Community / Classroom / Members.

-- ---------------------------------------------------------------------------
-- community_posts
-- ---------------------------------------------------------------------------
alter table public.community_posts
  add column if not exists search_tsv tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A')
    || setweight(to_tsvector('english', coalesce(body, '')), 'B')
  ) stored;

create index if not exists community_posts_search_tsv_idx
  on public.community_posts using gin (search_tsv);

-- ---------------------------------------------------------------------------
-- community_post_comments
-- ---------------------------------------------------------------------------
alter table public.community_post_comments
  add column if not exists search_tsv tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(body, '')), 'B')
  ) stored;

create index if not exists community_post_comments_search_tsv_idx
  on public.community_post_comments using gin (search_tsv);

-- ---------------------------------------------------------------------------
-- academy_lesson_content (content vs transcript so UI can nest transcript hits)
-- ---------------------------------------------------------------------------
alter table public.academy_lesson_content
  add column if not exists search_content_tsv tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A')
    || setweight(to_tsvector('english', coalesce(body_markdown, '')), 'B')
    || setweight(to_tsvector('english', coalesce(guide_markdown, '')), 'B')
  ) stored;

alter table public.academy_lesson_content
  add column if not exists search_transcript_tsv tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(transcript_text, '')), 'C')
  ) stored;

alter table public.academy_lesson_content
  add column if not exists search_tsv tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A')
    || setweight(to_tsvector('english', coalesce(body_markdown, '')), 'B')
    || setweight(to_tsvector('english', coalesce(guide_markdown, '')), 'B')
    || setweight(to_tsvector('english', coalesce(transcript_text, '')), 'C')
  ) stored;

create index if not exists academy_lesson_content_search_tsv_idx
  on public.academy_lesson_content using gin (search_tsv);

create index if not exists academy_lesson_content_search_content_tsv_idx
  on public.academy_lesson_content using gin (search_content_tsv);

create index if not exists academy_lesson_content_search_transcript_tsv_idx
  on public.academy_lesson_content using gin (search_transcript_tsv);

-- ---------------------------------------------------------------------------
-- academy_resources
-- ---------------------------------------------------------------------------
alter table public.academy_resources
  add column if not exists search_tsv tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A')
    || setweight(to_tsvector('english', coalesce(topic, '')), 'B')
  ) stored;

create index if not exists academy_resources_search_tsv_idx
  on public.academy_resources using gin (search_tsv);

-- ---------------------------------------------------------------------------
-- profiles (members)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists search_tsv tsvector
  generated always as (
    setweight(
      to_tsvector(
        'english',
        trim(
          both
          from coalesce(full_name, '')
            || ' '
            || coalesce(first_name, '')
            || ' '
            || coalesce(last_name, '')
            || ' '
            || coalesce(coach_business_name, '')
        )
      ),
      'A'
    )
    || setweight(
      to_tsvector(
        'english',
        coalesce(community_bio, '') || ' ' || coalesce(bio, '')
      ),
      'C'
    )
  ) stored;

create index if not exists profiles_search_tsv_idx
  on public.profiles using gin (search_tsv);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.search_query_to_tsquery(p_query text)
returns tsquery
language sql
immutable
as $$
  select case
    when p_query is null or length(btrim(p_query)) < 2 then null
    else websearch_to_tsquery('english', btrim(p_query))
  end;
$$;

create or replace function public.search_headline(p_doc text, p_query tsquery)
returns text
language sql
stable
as $$
  select case
    when p_doc is null or btrim(p_doc) = '' or p_query is null then null
    else ts_headline(
      'english',
      p_doc,
      p_query,
      'StartSel=<mark>, StopSel=</mark>, MaxWords=28, MinWords=12, MaxFragments=1, FragmentDelimiter= … '
    )
  end;
$$;

-- ---------------------------------------------------------------------------
-- Counts
-- ---------------------------------------------------------------------------
create or replace function public.search_academy_counts(p_query text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  q tsquery := public.search_query_to_tsquery(p_query);
  community_count bigint := 0;
  classroom_count bigint := 0;
  members_count bigint := 0;
begin
  if q is null then
    return jsonb_build_object(
      'community', 0,
      'classroom', 0,
      'members', 0
    );
  end if;

  select count(*) into community_count
  from (
    select p.id
    from public.community_posts p
    where p.search_tsv @@ q
      and p.published_at <= now()
      and (
        p.post_scope = 'feed'
        or (p.post_scope = 'lesson_qa' and p.visibility = 'public')
      )
    union
    select c.post_id
    from public.community_post_comments c
    inner join public.community_posts p on p.id = c.post_id
    where c.search_tsv @@ q
      and p.published_at <= now()
      and (
        p.post_scope = 'feed'
        or (p.post_scope = 'lesson_qa' and p.visibility = 'public')
      )
  ) community_hits;

  select count(*) into classroom_count
  from (
    select l.course_id::text || '/' || l.lesson_id as id
    from public.academy_lesson_content l
    where l.search_tsv @@ q
      and coalesce(l.is_draft, false) = false
      and coalesce(l.is_deleted, false) = false
    union
    select r.id::text
    from public.academy_resources r
    where r.search_tsv @@ q
  ) classroom_hits;

  select count(*) into members_count
  from public.profiles p
  left join public.coaches c on c.id = p.id
  where p.role in ('coach', 'admin')
    and (
      p.search_tsv @@ q
      or (
        c.slug is not null
        and to_tsvector('english', c.slug) @@ q
      )
    );

  return jsonb_build_object(
    'community', community_count,
    'classroom', classroom_count,
    'members', members_count
  );
end;
$$;

grant execute on function public.search_academy_counts(text) to service_role;

-- ---------------------------------------------------------------------------
-- Community results (posts + nested comment matches)
-- ---------------------------------------------------------------------------
create or replace function public.search_academy_community(
  p_query text,
  p_limit int default 20,
  p_offset int default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  q tsquery := public.search_query_to_tsquery(p_query);
  lim int := greatest(1, least(coalesce(p_limit, 20), 50));
  off int := greatest(0, coalesce(p_offset, 0));
  total bigint := 0;
  items jsonb := '[]'::jsonb;
begin
  if q is null then
    return jsonb_build_object('total', 0, 'items', '[]'::jsonb);
  end if;

  with post_hits as (
    select
      p.id as post_id,
      ts_rank_cd(p.search_tsv, q) as rank,
      public.search_headline(p.title, q) as title_headline,
      public.search_headline(p.body, q) as body_headline,
      null::uuid as comment_id,
      null::text as comment_headline,
      null::uuid as comment_author_id
    from public.community_posts p
    where p.search_tsv @@ q
      and p.published_at <= now()
      and (
        p.post_scope = 'feed'
        or (p.post_scope = 'lesson_qa' and p.visibility = 'public')
      )
  ),
  comment_hits as (
    select
      c.post_id,
      ts_rank_cd(c.search_tsv, q) as rank,
      null::text as title_headline,
      null::text as body_headline,
      c.id as comment_id,
      public.search_headline(c.body, q) as comment_headline,
      c.author_id as comment_author_id
    from public.community_post_comments c
    inner join public.community_posts p on p.id = c.post_id
    where c.search_tsv @@ q
      and p.published_at <= now()
      and (
        p.post_scope = 'feed'
        or (p.post_scope = 'lesson_qa' and p.visibility = 'public')
      )
  ),
  combined as (
    select * from post_hits
    union all
    select * from comment_hits
  ),
  grouped as (
    select
      post_id,
      max(rank) as rank,
      max(title_headline) filter (where title_headline is not null) as title_headline,
      max(body_headline) filter (where body_headline is not null) as body_headline,
      jsonb_agg(
        jsonb_build_object(
          'id', comment_id,
          'headline', comment_headline,
          'author_id', comment_author_id
        )
        order by rank desc
      ) filter (where comment_id is not null) as comments
    from combined
    group by post_id
  ),
  numbered as (
    select g.*, count(*) over () as total_count
    from grouped g
  ),
  page as (
    select *
    from numbered
    order by rank desc
    limit lim
    offset off
  )
  select
    coalesce((select total_count from page limit 1), 0),
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'title', p.title,
            'title_headline', pg.title_headline,
            'body_headline', pg.body_headline,
            'published_at', p.published_at,
            'created_at', p.created_at,
            'post_scope', p.post_scope,
            'lesson_path', p.lesson_path,
            'lesson_course_id', p.lesson_course_id,
            'lesson_id', p.lesson_id,
            'like_count', coalesce(p.feed_like_count, 0),
            'comment_count', coalesce(p.feed_comment_count, 0),
            'category_label', cat.label,
            'author', jsonb_build_object(
              'id', a.id,
              'full_name', a.full_name,
              'first_name', a.first_name,
              'last_name', a.last_name,
              'avatar_url', a.avatar_url
            ),
            'comments', coalesce(pg.comments, '[]'::jsonb)
          )
          order by pg.rank desc
        )
        from page pg
        inner join public.community_posts p on p.id = pg.post_id
        left join public.profiles a on a.id = p.author_id
        left join public.community_categories cat on cat.id = p.category_id
      ),
      '[]'::jsonb
    )
  into total, items;

  return jsonb_build_object('total', total, 'items', items);
end;
$$;

grant execute on function public.search_academy_community(text, int, int) to service_role;

-- ---------------------------------------------------------------------------
-- Classroom (lessons + resources)
-- ---------------------------------------------------------------------------
create or replace function public.search_academy_classroom(
  p_query text,
  p_limit int default 20,
  p_offset int default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  q tsquery := public.search_query_to_tsquery(p_query);
  lim int := greatest(1, least(coalesce(p_limit, 20), 50));
  off int := greatest(0, coalesce(p_offset, 0));
  total bigint := 0;
  items jsonb := '[]'::jsonb;
begin
  if q is null then
    return jsonb_build_object('total', 0, 'items', '[]'::jsonb);
  end if;

  with lesson_hits as (
    select
      'lesson'::text as kind,
      l.course_id || '/' || l.lesson_id as id,
      l.course_id,
      l.lesson_id,
      coalesce(nullif(btrim(l.title), ''), l.lesson_id) as title,
      public.search_headline(coalesce(l.title, ''), q) as title_headline,
      case
        when l.search_content_tsv @@ q then
          coalesce(
            public.search_headline(coalesce(l.body_markdown, ''), q),
            public.search_headline(coalesce(l.guide_markdown, ''), q)
          )
        else null
      end as body_headline,
      case
        when l.search_transcript_tsv @@ q then
          public.search_headline(coalesce(l.transcript_text, ''), q)
        else null
      end as transcript_headline,
      (l.search_content_tsv @@ q) as content_match,
      (l.search_transcript_tsv @@ q) as transcript_match,
      ts_rank_cd(l.search_tsv, q) as rank,
      null::text as section_title,
      null::text as topic,
      null::text as url,
      null::uuid as resource_id
    from public.academy_lesson_content l
    where l.search_tsv @@ q
      and coalesce(l.is_draft, false) = false
      and coalesce(l.is_deleted, false) = false
  ),
  resource_hits as (
    select
      'resource'::text as kind,
      r.id::text as id,
      null::text as course_id,
      null::text as lesson_id,
      r.title,
      public.search_headline(r.title, q) as title_headline,
      public.search_headline(coalesce(r.topic, ''), q) as body_headline,
      null::text as transcript_headline,
      true as content_match,
      false as transcript_match,
      ts_rank_cd(r.search_tsv, q) as rank,
      s.title as section_title,
      r.topic,
      r.url,
      r.id as resource_id
    from public.academy_resources r
    left join public.academy_resource_sections s on s.id = r.section_id
    where r.search_tsv @@ q
  ),
  combined as (
    select * from lesson_hits
    union all
    select * from resource_hits
  ),
  numbered as (
    select c.*, count(*) over () as total_count
    from combined c
  ),
  page as (
    select *
    from numbered
    order by rank desc, title asc
    limit lim
    offset off
  )
  select
    coalesce((select total_count from page limit 1), 0),
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'kind', pg.kind,
            'id', pg.id,
            'course_id', pg.course_id,
            'lesson_id', pg.lesson_id,
            'title', pg.title,
            'title_headline', pg.title_headline,
            'body_headline', pg.body_headline,
            'transcript_headline', pg.transcript_headline,
            'content_match', pg.content_match,
            'transcript_match', pg.transcript_match,
            'section_title', pg.section_title,
            'topic', pg.topic,
            'url', pg.url,
            'resource_id', pg.resource_id
          )
          order by pg.rank desc, pg.title asc
        )
        from page pg
      ),
      '[]'::jsonb
    )
  into total, items;

  return jsonb_build_object('total', total, 'items', items);
end;
$$;

grant execute on function public.search_academy_classroom(text, int, int) to service_role;

-- ---------------------------------------------------------------------------
-- Members
-- ---------------------------------------------------------------------------
create or replace function public.search_academy_members(
  p_query text,
  p_limit int default 20,
  p_offset int default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  q tsquery := public.search_query_to_tsquery(p_query);
  lim int := greatest(1, least(coalesce(p_limit, 20), 50));
  off int := greatest(0, coalesce(p_offset, 0));
  total bigint := 0;
  items jsonb := '[]'::jsonb;
  q_plain text := lower(btrim(coalesce(p_query, '')));
begin
  if q is null then
    return jsonb_build_object('total', 0, 'items', '[]'::jsonb);
  end if;

  with hits as (
    select
      p.id,
      p.full_name,
      p.first_name,
      p.last_name,
      p.coach_business_name,
      p.avatar_url,
      p.role,
      p.created_at,
      coalesce(nullif(btrim(p.community_bio), ''), nullif(btrim(p.bio), '')) as bio,
      c.slug,
      greatest(
        coalesce(ts_rank_cd(p.search_tsv, q), 0),
        case
          when c.slug is not null and c.slug ilike q_plain || '%' then 0.5
          when c.slug is not null and c.slug ilike '%' || q_plain || '%' then 0.2
          else 0
        end
      ) as rank,
      public.search_headline(
        coalesce(nullif(btrim(p.community_bio), ''), nullif(btrim(p.bio), ''), ''),
        q
      ) as bio_headline
    from public.profiles p
    left join public.coaches c on c.id = p.id
    where p.role in ('coach', 'admin')
      and (
        p.search_tsv @@ q
        or (c.slug is not null and c.slug ilike '%' || q_plain || '%')
      )
  ),
  numbered as (
    select h.*, count(*) over () as total_count
    from hits h
  ),
  page as (
    select *
    from numbered
    order by rank desc, full_name asc nulls last
    limit lim
    offset off
  )
  select
    coalesce((select total_count from page limit 1), 0),
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', pg.id,
            'full_name', pg.full_name,
            'first_name', pg.first_name,
            'last_name', pg.last_name,
            'coach_business_name', pg.coach_business_name,
            'avatar_url', pg.avatar_url,
            'role', pg.role,
            'slug', pg.slug,
            'bio', pg.bio,
            'bio_headline', pg.bio_headline,
            'created_at', pg.created_at
          )
          order by pg.rank desc, pg.full_name asc nulls last
        )
        from page pg
      ),
      '[]'::jsonb
    )
  into total, items;

  return jsonb_build_object('total', total, 'items', items);
end;
$$;

grant execute on function public.search_academy_members(text, int, int) to service_role;
