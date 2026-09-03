alter table public.messaging_conversations
  add column if not exists prospect_linkedin_url text;

comment on column public.messaging_conversations.prospect_linkedin_url is
  'Public LinkedIn profile URL for the other person, from Unipile or a linked prospect.';
