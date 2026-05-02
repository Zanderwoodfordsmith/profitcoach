-- Coach income ledger: manual (and future automated) revenue lines per client/month rollups

create table if not exists coach_revenue_lines (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null default 'GBP',
  occurred_on date not null,
  source text not null default 'manual' check (source in ('manual', 'stripe', 'import')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists coach_revenue_lines_coach_id_occurred_on
  on coach_revenue_lines (coach_id, occurred_on desc);

create index if not exists coach_revenue_lines_coach_contact
  on coach_revenue_lines (coach_id, contact_id);

create or replace function public.coach_revenue_lines_contact_belongs_coach()
returns trigger
language plpgsql
as $$
begin
  if new.contact_id is not null then
    if not exists (
      select 1
      from contacts c
      where c.id = new.contact_id
        and c.coach_id is not null
        and c.coach_id = new.coach_id
    ) then
      raise exception 'contact_id must reference a contact owned by this coach';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists coach_revenue_lines_contact_check on coach_revenue_lines;
create trigger coach_revenue_lines_contact_check
  before insert or update of coach_id, contact_id
  on coach_revenue_lines
  for each row
  execute procedure public.coach_revenue_lines_contact_belongs_coach();

create or replace function public.coach_revenue_lines_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists coach_revenue_lines_updated_at on coach_revenue_lines;
create trigger coach_revenue_lines_updated_at
  before update on coach_revenue_lines
  for each row
  execute procedure public.coach_revenue_lines_set_updated_at();

alter table coach_revenue_lines enable row level security;

drop policy if exists "Coaches manage own revenue lines" on coach_revenue_lines;
create policy "Coaches manage own revenue lines"
  on coach_revenue_lines
  for all
  to authenticated
  using (coach_id = (select auth.uid()))
  with check (coach_id = (select auth.uid()));

comment on table coach_revenue_lines is 'Cash-basis income entries; aggregate for client x month reporting.';

grant select, insert, update, delete on coach_revenue_lines to authenticated;
