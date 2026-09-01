-- Classroom search: title/body matches outrank loose transcript hits.
-- Multi-word queries must appear as a phrase in transcripts (not "people"
-- in one minute and "buying" twenty minutes later).

create or replace function public.search_query_to_phrase_tsquery(p_query text)
returns tsquery
language sql
immutable
as $$
  select case
    when p_query is null or length(btrim(p_query)) < 2 then null
    else phraseto_tsquery('english', btrim(p_query))
  end;
$$;

create or replace function public.search_academy_counts(p_query text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  q tsquery := public.search_query_to_tsquery(p_query);
  q_phrase tsquery := public.search_query_to_phrase_tsquery(p_query);
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

  if q_phrase is null or numnode(q_phrase) = 0 then
    q_phrase := q;
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
    where coalesce(l.is_draft, false) = false
      and coalesce(l.is_deleted, false) = false
      and (
        l.search_content_tsv @@ q
        or l.search_transcript_tsv @@ q_phrase
        or (numnode(q) <= 1 and l.search_transcript_tsv @@ q)
      )
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
  q_phrase tsquery := public.search_query_to_phrase_tsquery(p_query);
  lim int := greatest(1, least(coalesce(p_limit, 20), 50));
  off int := greatest(0, coalesce(p_offset, 0));
  total bigint := 0;
  items jsonb := '[]'::jsonb;
begin
  if q is null then
    return jsonb_build_object('total', 0, 'items', '[]'::jsonb);
  end if;

  if q_phrase is null or numnode(q_phrase) = 0 then
    q_phrase := q;
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
        when l.search_transcript_tsv @@ q_phrase
          or (numnode(q) <= 1 and l.search_transcript_tsv @@ q)
        then
          public.search_headline(
            coalesce(l.transcript_text, ''),
            case
              when l.search_transcript_tsv @@ q_phrase then q_phrase
              else q
            end
          )
        else null
      end as transcript_headline,
      (l.search_content_tsv @@ q) as content_match,
      (
        l.search_transcript_tsv @@ q_phrase
        or (numnode(q) <= 1 and l.search_transcript_tsv @@ q)
      ) as transcript_match,
      (
        (l.search_content_tsv @@ q)::int * 5.0
        + coalesce(ts_rank_cd(l.search_content_tsv, q), 0) * 4.0
        + (l.search_transcript_tsv @@ q_phrase)::int * 0.8
        + coalesce(ts_rank_cd(l.search_transcript_tsv, q_phrase), 0) * 0.5
      ) as rank,
      null::text as section_title,
      null::text as topic,
      null::text as url,
      null::uuid as resource_id
    from public.academy_lesson_content l
    where coalesce(l.is_draft, false) = false
      and coalesce(l.is_deleted, false) = false
      and (
        l.search_content_tsv @@ q
        or l.search_transcript_tsv @@ q_phrase
        or (numnode(q) <= 1 and l.search_transcript_tsv @@ q)
      )
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
      (2.0 + coalesce(ts_rank_cd(r.search_tsv, q), 0) * 3.0) as rank,
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
    order by content_match desc, rank desc, title asc
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
          order by pg.content_match desc, pg.rank desc, pg.title asc
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
grant execute on function public.search_query_to_phrase_tsquery(text) to service_role;
