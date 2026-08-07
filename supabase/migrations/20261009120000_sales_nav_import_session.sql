-- Singleton Sales Navigator session for Lead Finder import (ops / allowlisted admins).
-- Cookie never exposed to coaches; only Lead Finder admin API reads/writes via service role.

CREATE TABLE IF NOT EXISTS public.sales_nav_import_session (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  cookie_payload text NOT NULL,
  user_agent text,
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_nav_import_session ENABLE ROW LEVEL SECURITY;

-- No policies for anon/authenticated — service role only.
COMMENT ON TABLE public.sales_nav_import_session IS
  'Shared BCA Sales Navigator cookie session for Apify lead import. Singleton row id=1.';
