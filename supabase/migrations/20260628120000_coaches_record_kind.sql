-- Distinguish Disco/active members from payment-only historical coach records.
alter table public.coaches
  add column if not exists record_kind text not null default 'member';

alter table public.coaches
  drop constraint if exists coaches_record_kind_check;

alter table public.coaches
  add constraint coaches_record_kind_check
  check (record_kind in ('member', 'historical'));

comment on column public.coaches.record_kind is
  'member = active community account; historical = payment attribution only (no real login).';

create index if not exists coaches_record_kind_idx
  on public.coaches (record_kind);
