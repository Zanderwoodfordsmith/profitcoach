-- Allow achievements without a recorded marketing date (achieved_on null).
-- Safe if the column is already nullable (no-op).
alter table if exists public.community_ladder_achievements
  alter column achieved_on drop not null;
