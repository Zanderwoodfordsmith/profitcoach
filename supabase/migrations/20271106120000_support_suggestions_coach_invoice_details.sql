-- Suggested Support replies: drafted before BCA opens the chat. Staff only: read
-- and written by the server with the service role, so no policies.
create table if not exists public.support_reply_suggestions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.community_feedback_reports (id) on delete cascade,
  -- The coach message this answers. A new message from them gets a new draft.
  based_on_at timestamptz not null,
  status text not null default 'drafting'
    check (status in ('drafting', 'ready', 'failed', 'dismissed', 'sent')),
  body text,
  confidence text check (confidence in ('high', 'medium', 'low')),
  confidence_reason text,
  model text,
  -- What BCA really sent, to compare with the draft over time.
  sent_reply_id uuid references public.community_feedback_replies (id) on delete set null,
  sent_body text,
  changed_share numeric(4, 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (report_id, based_on_at)
);

create index if not exists support_reply_suggestions_report_idx
  on public.support_reply_suggestions (report_id, based_on_at desc);

alter table public.support_reply_suggestions enable row level security;

-- Who a coach's invoices are made out to. Kept apart from profiles, whose fields
-- feed the community and directory, because this can hold a home address.
create table if not exists public.coach_invoice_details (
  coach_id uuid primary key references public.coaches (id) on delete cascade,
  business_name text,
  address text,
  company_number text,
  vat_number text,
  updated_at timestamptz not null default now()
);

alter table public.coach_invoice_details enable row level security;
