-- Community search: post title/body matches outrank comment-only hits.
-- Also return a post body preview and comment timestamps so comment hits
-- still render the parent post with nested highlighted comments.

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
      null::uuid as comment_author_id,
      null::timestamptz as comment_created_at
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
      ts_rank_cd(c.search_tsv, q) * 0.35 as rank,
      null::text as title_headline,
      null::text as body_headline,
      c.id as comment_id,
      public.search_headline(c.body, q) as comment_headline,
      c.author_id as comment_author_id,
      c.created_at as comment_created_at
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
      bool_or(comment_id is null) as post_match,
      max(rank) as rank,
      max(title_headline) filter (where title_headline is not null) as title_headline,
      max(body_headline) filter (where body_headline is not null) as body_headline,
      jsonb_agg(
        jsonb_build_object(
          'id', comment_id,
          'headline', comment_headline,
          'author_id', comment_author_id,
          'created_at', comment_created_at
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
    order by post_match desc, rank desc
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
            'body_preview', left(
              regexp_replace(coalesce(p.body, ''), E'\\s+', ' ', 'g'),
              280
            ),
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
          order by pg.post_match desc, pg.rank desc
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
