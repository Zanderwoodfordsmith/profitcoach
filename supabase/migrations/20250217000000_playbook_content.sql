-- Editable playbook Overview content (admin UI). ref matches bossData playbook refs.
create table if not exists playbook_content (
  ref text primary key,
  what_this_is text,
  what_it_looks_like jsonb,
  things_to_think_about jsonb default '[]',
  plays jsonb default '[]',
  quick_wins jsonb default '[]',
  related_playbooks jsonb default '[]',
  updated_at timestamptz not null default now()
);

comment on table playbook_content is 'Overview tab content per playbook; loaded before file/fallback';
