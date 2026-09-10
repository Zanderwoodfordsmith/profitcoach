-- Map alternate From-addresses → coach/admin profiles for support mailbox ingest.
-- Auth login email still matches directly; this covers work aliases (e.g. ashley@company).

create table if not exists public.support_email_aliases (
  email text primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null
);

comment on table public.support_email_aliases is
  'Lowercased email → coach/admin profile for support inbox auto-link.';

create index if not exists support_email_aliases_profile_id_idx
  on public.support_email_aliases (profile_id);

alter table public.support_email_aliases enable row level security;

drop policy if exists "Admins select support email aliases"
  on public.support_email_aliases;
create policy "Admins select support email aliases"
  on public.support_email_aliases
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins insert support email aliases"
  on public.support_email_aliases;
create policy "Admins insert support email aliases"
  on public.support_email_aliases
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Admins update support email aliases"
  on public.support_email_aliases;
create policy "Admins update support email aliases"
  on public.support_email_aliases
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins delete support email aliases"
  on public.support_email_aliases;
create policy "Admins delete support email aliases"
  on public.support_email_aliases
  for delete
  to authenticated
  using (public.is_admin());

-- Seed from tickets already linked (most recent wins on conflict).
insert into public.support_email_aliases (email, profile_id)
select distinct on (lower(trim(r.contact_email)))
  lower(trim(r.contact_email)),
  r.created_by
from public.community_feedback_reports r
join public.profiles p on p.id = r.created_by
where r.contact_email is not null
  and length(trim(r.contact_email)) > 3
  and r.created_by is not null
  and p.role in ('coach', 'admin')
order by lower(trim(r.contact_email)), r.created_at desc
on conflict (email) do nothing;
