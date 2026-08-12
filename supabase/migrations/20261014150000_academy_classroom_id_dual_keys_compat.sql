-- Compat dual-keys after classroom id rename.
-- Production still serves old hub ids (client-acquisition-*, kickstart-*, …)
-- while the rename migrations store content under the new ids. Keep both until
-- the renamed hub is deployed, then old keys can be dropped.

-- Applied manually 2026-08-12 via restore script (dual-write from new → old).
-- This file documents the intent for migration history; re-running is safe if
-- the dual-write script is used again.

select 1;
