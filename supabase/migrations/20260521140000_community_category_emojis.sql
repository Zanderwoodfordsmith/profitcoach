-- Follow-up to 20260521120000: emoji labels + sort order (safe if that migration already ran).

-- Legacy slugs → current slugs (no-op if already renamed)
update public.community_categories
set slug = 'requesting-feedback',
    label = '🔍 Requesting feedback',
    sort_order = 4
where slug = 'technical';

update public.community_categories
set slug = 'intros',
    label = '👋 Intros',
    sort_order = 5
where slug = 'resources';

-- Labels + display order (matches chip order: General → Wins → Announcements → …)
update public.community_categories
set label = '💬 General Discussion',
    sort_order = 1
where slug = 'general';

update public.community_categories
set label = '🏆 Wins',
    sort_order = 2
where slug = 'wins';

update public.community_categories
set label = '🚨 Announcements',
    sort_order = 3
where slug = 'announcements';

update public.community_categories
set label = '🔍 Requesting feedback',
    sort_order = 4
where slug = 'requesting-feedback';

update public.community_categories
set label = '👋 Intros',
    sort_order = 5
where slug = 'intros';
