-- Remove unwanted seeded community categories.
-- Keeps existing posts valid by remapping them to "general" before delete.

do $$
declare
  general_id uuid;
begin
  -- Ensure "general" exists and capture its id.
  insert into public.community_categories (slug, label, sort_order)
  values ('general', 'General', 1)
  on conflict (slug) do nothing;

  select id into general_id
  from public.community_categories
  where slug = 'general'
  limit 1;

  if general_id is null then
    raise exception 'Could not resolve general community category id.';
  end if;

  -- Move existing posts out of unwanted categories first (FK-safe).
  update public.community_posts
  set category_id = general_id
  where category_id in (
    select id
    from public.community_categories
    where slug in ('technical', 'resources')
  );

  -- Remove unwanted categories.
  delete from public.community_categories
  where slug in ('technical', 'resources');
end
$$;
