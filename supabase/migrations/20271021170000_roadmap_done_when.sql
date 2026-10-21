-- Roadmap: "Done when" gets its own field, the line Review checks against.
-- Existing "Done when:" paragraphs are moved out of notes by a one-off script.

alter table public.roadmap_jobs
  add column if not exists done_when text;
