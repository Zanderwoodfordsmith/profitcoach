# Supabase migrations

Run these migrations in your Supabase project so the app has the required tables.

**If you see "Could not find the table 'public.playbook_content' in the schema cache":**

1. Open your [Supabase Dashboard](https://supabase.com/dashboard) → your project → **SQL Editor**.
2. Run the migrations in order (oldest first):
   - Copy the contents of `migrations/20250212000000_landing_ab_tests.sql` and run it (if not already applied).
   - Continue with each file in date order.
   - For the playbook editor, you need at least:
     - `20250216000000_playbook_tab_status.sql` — creates `playbook_tab_status` (Overview/Client/Coaches status)
     - `20250217000000_playbook_content.sql` — creates `playbook_content`
     - `20250217100000_playbook_content_plays_sections.sql` — adds plays intro/sections columns
3. After running, the schema cache updates and the table will be found.

Alternatively, if you use the Supabase CLI: `supabase db push`
