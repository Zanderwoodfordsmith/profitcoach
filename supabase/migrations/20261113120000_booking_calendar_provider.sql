-- Per-coach booking calendar engine: Profit Coach native vs GHL/CRM embed.
-- New coaches default to native; existing rows are backfilled to ghl so current embeds keep working.

alter table public.coaches
  add column if not exists booking_calendar_provider text;

update public.coaches
set booking_calendar_provider = 'ghl'
where booking_calendar_provider is null;

alter table public.coaches
  alter column booking_calendar_provider set default 'native';

alter table public.coaches
  alter column booking_calendar_provider set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'coaches_booking_calendar_provider_check'
  ) then
    alter table public.coaches
      add constraint coaches_booking_calendar_provider_check
      check (booking_calendar_provider in ('native', 'ghl'));
  end if;
end $$;

comment on column public.coaches.booking_calendar_provider is
  'Which calendar engine prospects see on coach-owned booking surfaces: native (Profit Coach) or ghl (CRM embed).';
