-- Community feed category labels / slugs (see product copy).

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
set slug = 'requesting-feedback',
    label = '🔍 Requesting feedback',
    sort_order = 4
where slug = 'technical';

update public.community_categories
set slug = 'intros',
    label = '👋 Intros',
    sort_order = 5
where slug = 'resources';
