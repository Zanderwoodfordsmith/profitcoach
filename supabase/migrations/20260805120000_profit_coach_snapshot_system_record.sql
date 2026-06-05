-- Profit Coach Snapshot is an internal GHL test account, not a real member join.

alter table public.coaches
  drop constraint if exists coaches_record_kind_check;

alter table public.coaches
  add constraint coaches_record_kind_check
  check (record_kind in ('member', 'historical', 'system'));

comment on column public.coaches.record_kind is
  'member = active coach; historical = pre-app import; system = internal test/marketing accounts.';

update public.coaches
set record_kind = 'system'
where slug = 'profit-coach-snapshot';
