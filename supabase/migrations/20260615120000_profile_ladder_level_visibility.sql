alter table public.profiles
add column if not exists show_ladder_level_on_profile boolean not null default false;
