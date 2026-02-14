-- Admin-editable status for each playbook tab (Overview, Client, Coaches)
-- Values: done | in_progress | not_started

create table if not exists playbook_tab_status (
  ref text primary key,
  overview text not null default 'not_started' check (overview in ('done', 'in_progress', 'not_started')),
  client text not null default 'not_started' check (client in ('done', 'in_progress', 'not_started')),
  coaches text not null default 'not_started' check (coaches in ('done', 'in_progress', 'not_started'))
);
