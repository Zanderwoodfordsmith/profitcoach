-- Add priority to time tracker blocks.
-- Separate migration because 20260801130000 may already have been applied
-- before the priority column existed.

alter table public.time_tracker_block
  add column if not exists priority text not null default 'none';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'time_tracker_block_priority_check'
  ) then
    alter table public.time_tracker_block
      add constraint time_tracker_block_priority_check
      check (priority in ('high', 'medium', 'low', 'none'));
  end if;
end $$;
