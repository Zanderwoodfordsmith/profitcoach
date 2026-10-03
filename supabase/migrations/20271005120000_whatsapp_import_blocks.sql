-- Numbers and contacts a coach has asked us not to import from WhatsApp.
-- Sync does not scan recent personal chats; this also opts a pool, prospect,
-- or client number out.

create table if not exists public.messaging_import_blocks (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches (id) on delete cascade,
  channel text not null check (channel = 'whatsapp'),
  phone_key text,
  contact_id uuid references public.contacts (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint messaging_import_blocks_target_chk
    check (phone_key is not null or contact_id is not null)
);

create unique index if not exists messaging_import_blocks_phone_uidx
  on public.messaging_import_blocks (coach_id, channel, phone_key)
  where phone_key is not null;

create unique index if not exists messaging_import_blocks_contact_uidx
  on public.messaging_import_blocks (coach_id, channel, contact_id)
  where contact_id is not null;

alter table public.messaging_import_blocks enable row level security;

create policy "Coaches read own import blocks"
  on public.messaging_import_blocks
  for select
  using (auth.uid() = coach_id);

comment on table public.messaging_import_blocks is
  'WhatsApp numbers a coach has asked us not to import. Personal chat history is never scanned; this also blocks a pool, prospect, or client number.';
