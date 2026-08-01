-- Relabel the requesting-feedback / Q&A community channel to Ask & Share.
-- Slug stays `requesting-feedback` so access gates and app code keep working.

update public.community_categories
set label = '🗣️ Ask & Share'
where slug = 'requesting-feedback';
