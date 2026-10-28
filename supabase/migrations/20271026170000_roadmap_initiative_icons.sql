-- An icon and a colour for each initiative (like Linear). The app keeps the
-- lists of allowed icons and colours. Additive only.
alter table public.roadmap_initiatives
  add column if not exists icon text,
  add column if not exists color text;

-- Draft picks for the first four (26 Oct), Zander to change.
update public.roadmap_initiatives set icon = 'trending-up', color = 'emerald' where name = 'New coaches win clients fast' and icon is null;
update public.roadmap_initiatives set icon = 'sparkles', color = 'violet' where name = 'BCA builds the practice for them' and icon is null;
update public.roadmap_initiatives set icon = 'heart', color = 'rose' where name = 'Coaches keep clients and stay' and icon is null;
update public.roadmap_initiatives set icon = 'rocket', color = 'sky' where name = 'The app and how we ship' and icon is null;
