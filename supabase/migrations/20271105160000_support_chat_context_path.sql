-- What a Support chat is about (5 Nov): the page in the app it concerns, such
-- as Settings → Integrations or a Blueprint page, so the coach gets an "Open
-- … page" button beside the chat. Kept apart from page_path, which is where
-- the chat was written. Set by BCA in the reply view (with the AI's
-- suggestions), by the AI when a chat starts, and later by "Get help with
-- this". Null when a chat isn't about one page. Additive only.

alter table public.community_feedback_reports
  add column if not exists context_path text;
