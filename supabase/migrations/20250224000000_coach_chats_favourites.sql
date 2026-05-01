-- Favourites for coach AI chats: star and optional sort order within Favourites list only.

alter table coach_chats add column if not exists is_favourite boolean not null default false;
alter table coach_chats add column if not exists favourite_sort_order int null;
