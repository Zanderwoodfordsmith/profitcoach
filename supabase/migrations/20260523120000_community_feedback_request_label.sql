-- Shorter category label to free horizontal space next to other chips.

update public.community_categories
set label = '🔍 Feedback request'
where slug = 'requesting-feedback';
