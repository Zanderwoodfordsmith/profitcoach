-- Reply copilot: admin singleton prompt + model, plus per-coach style overlay.
-- Empty system_prompt falls back to REPLY_COPILOT_DEFAULT_VOICE in code.

create table if not exists public.reply_copilot_settings (
  id uuid primary key default gen_random_uuid(),
  system_prompt text not null default '',
  model text not null default 'claude-sonnet-4-6',
  updated_at timestamptz not null default now()
);

alter table public.reply_copilot_settings enable row level security;

drop policy if exists "Service role can manage reply_copilot_settings"
  on public.reply_copilot_settings;
create policy "Service role can manage reply_copilot_settings"
  on public.reply_copilot_settings for all
  to service_role
  using (true)
  with check (true);

revoke all on public.reply_copilot_settings from anon, authenticated;
grant all on public.reply_copilot_settings to service_role;

alter table public.coaches
  add column if not exists reply_copilot_notes text;

comment on column public.coaches.reply_copilot_notes is
  'Optional coach overlay for the Conversations reply copilot. Empty = admin prompt only.';
