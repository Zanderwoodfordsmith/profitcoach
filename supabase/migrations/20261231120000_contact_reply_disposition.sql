-- Coach-marked reply sentiment on a prospect (interested / later / not interested).
alter table public.contacts
  add column if not exists reply_disposition text
    check (
      reply_disposition is null
      or reply_disposition in ('interested', 'neutral', 'not_interested')
    );

alter table public.contacts
  add column if not exists reply_disposition_at timestamptz;

comment on column public.contacts.reply_disposition is
  'Manual classification of the latest outreach reply: interested, neutral (maybe later), or not_interested.';
