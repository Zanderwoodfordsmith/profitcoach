-- When someone leaves, admins remove their access instead of deleting them:
-- login blocked, contact details cleared, name and avatar kept for their posts.
-- Set by POST /api/admin/coaches/[slug]/remove-access; hides them from the
-- member list and @-mention picker.

alter table public.profiles
  add column if not exists access_removed_at timestamptz;
