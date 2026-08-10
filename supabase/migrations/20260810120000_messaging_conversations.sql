-- Bird-backed messaging: conversations + messages (email/SMS/WhatsApp).
create table if not exists public.messaging_conversations (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete set null,
  booking_id uuid references public.bookings (id) on delete set null,
  subject text,
  prospect_name text,
  prospect_email text,
  prospect_phone text,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists messaging_conversations_coach_last_idx
  on public.messaging_conversations (coach_id, last_message_at desc);

create index if not exists messaging_conversations_contact_idx
  on public.messaging_conversations (contact_id);

create index if not exists messaging_conversations_booking_idx
  on public.messaging_conversations (booking_id);

comment on table public.messaging_conversations is
  'Omnichannel conversation threads per coach/contact (Bird email/SMS/etc.).';

create table if not exists public.messaging_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.messaging_conversations (id) on delete cascade,
  coach_id uuid not null references public.coaches (id) on delete cascade,
  channel text not null check (channel in ('email', 'sms', 'whatsapp', 'voice', 'system')),
  direction text not null check (direction in ('outbound', 'inbound')),
  status text not null default 'accepted',
  subject text,
  body_text text,
  body_html text,
  from_address text,
  to_address text,
  bird_message_id text,
  provider_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists messaging_messages_conversation_created_idx
  on public.messaging_messages (conversation_id, created_at asc);

create index if not exists messaging_messages_coach_created_idx
  on public.messaging_messages (coach_id, created_at desc);

create index if not exists messaging_messages_bird_id_idx
  on public.messaging_messages (bird_message_id);

comment on table public.messaging_messages is
  'Individual messages in a messaging_conversations thread.';

create or replace function public.set_messaging_conversations_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_messaging_conversations_updated_at
  on public.messaging_conversations;
create trigger trg_messaging_conversations_updated_at
before update on public.messaging_conversations
for each row execute function public.set_messaging_conversations_updated_at();

alter table public.messaging_conversations enable row level security;
alter table public.messaging_messages enable row level security;

create policy "Coaches read own messaging conversations"
  on public.messaging_conversations
  for select
  using (auth.uid() = coach_id);

create policy "Admins read all messaging conversations"
  on public.messaging_conversations
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "Coaches read own messaging messages"
  on public.messaging_messages
  for select
  using (auth.uid() = coach_id);

create policy "Admins read all messaging messages"
  on public.messaging_messages
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "messaging_conversations_service_role"
  on public.messaging_conversations
  for all
  to service_role
  using (true)
  with check (true);

create policy "messaging_messages_service_role"
  on public.messaging_messages
  for all
  to service_role
  using (true)
  with check (true);
