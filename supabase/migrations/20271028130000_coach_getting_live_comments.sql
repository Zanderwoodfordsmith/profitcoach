-- Getting live: a comment thread per coach (on the coach's admin page, Getting
-- live tab), in place of the single notes box. Each comment:
-- { id, by, by_name, at, body, edited_at?, replies: [{ id, by, by_name, at, body }] }.
-- Notes written so far become each coach's first comment. Additive only: the
-- notes column stays.

alter table public.coach_getting_live
  add column if not exists comments jsonb not null default '[]'::jsonb;

update public.coach_getting_live g
set comments = jsonb_build_array(
  jsonb_build_object(
    'id', gen_random_uuid()::text,
    'by', g.updated_by,
    'by_name', p.full_name,
    'at', g.updated_at,
    'body', g.notes,
    'replies', '[]'::jsonb
  )
)
from (select g2.coach_id, pr.full_name
      from public.coach_getting_live g2
      left join public.profiles pr on pr.id = g2.updated_by) p
where p.coach_id = g.coach_id
  and btrim(coalesce(g.notes, '')) <> ''
  and g.comments = '[]'::jsonb;
