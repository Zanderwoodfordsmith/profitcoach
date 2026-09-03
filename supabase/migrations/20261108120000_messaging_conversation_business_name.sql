alter table public.messaging_conversations
  add column if not exists prospect_business_name text;

comment on column public.messaging_conversations.prospect_business_name is
  'Company / business name for the other person. Editable from the inbox Details panel.';
