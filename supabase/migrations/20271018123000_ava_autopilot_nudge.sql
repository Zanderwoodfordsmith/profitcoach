-- When Ava sent the one follow-up nudge after an unanswered time offer.
alter table public.ava_reply_triage add column if not exists nudged_at timestamptz;
