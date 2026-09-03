-- Scheduled inbox messages (LinkedIn / WhatsApp / etc via Unipile).
create table if not exists public.messaging_scheduled_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.messaging_conversations (id) on delete cascade,
  coach_id uuid not null references public.coaches (id) on delete cascade,
  channel text not null,
  body_text text,
  attachments jsonb not null default '[]'::jsonb,
  scheduled_for timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'sending', 'sent', 'failed', 'cancelled')),
  attempts integer not null default 0,
  last_error text,
  sent_message_id uuid references public.messaging_messages (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists messaging_scheduled_messages_due_idx
  on public.messaging_scheduled_messages (status, scheduled_for)
  where status = 'scheduled';

create index if not exists messaging_scheduled_messages_conversation_idx
  on public.messaging_scheduled_messages (conversation_id, scheduled_for desc);

create index if not exists messaging_scheduled_messages_coach_idx
  on public.messaging_scheduled_messages (coach_id, scheduled_for desc);

comment on table public.messaging_scheduled_messages is
  'Queue for send-later inbox replies (Unipile chat channels).';

create or replace function public.set_messaging_scheduled_messages_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_messaging_scheduled_messages_updated_at
  on public.messaging_scheduled_messages;
create trigger trg_messaging_scheduled_messages_updated_at
before update on public.messaging_scheduled_messages
for each row execute function public.set_messaging_scheduled_messages_updated_at();

alter table public.messaging_scheduled_messages enable row level security;

drop policy if exists "Coaches read own scheduled messages"
  on public.messaging_scheduled_messages;
create policy "Coaches read own scheduled messages"
  on public.messaging_scheduled_messages
  for select
  using (auth.uid() = coach_id);

drop policy if exists "Admins read all scheduled messages"
  on public.messaging_scheduled_messages;
create policy "Admins read all scheduled messages"
  on public.messaging_scheduled_messages
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "messaging_scheduled_messages_service_role"
  on public.messaging_scheduled_messages;
create policy "messaging_scheduled_messages_service_role"
  on public.messaging_scheduled_messages
  for all
  to service_role
  using (true)
  with check (true);

-- Private attachment storage for inbox media (signed URLs for display).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'messaging-attachments',
  'messaging-attachments',
  false,
  15728640,
  array[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Coaches read own messaging attachments" on storage.objects;
create policy "Coaches read own messaging attachments"
on storage.objects for select
using (
  bucket_id = 'messaging-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Admins read messaging attachments" on storage.objects;
create policy "Admins read messaging attachments"
on storage.objects for select
using (
  bucket_id = 'messaging-attachments'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);
