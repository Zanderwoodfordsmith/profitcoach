-- Plays intro paragraph and optional sections (title, description, plays per section).
alter table playbook_content
  add column if not exists plays_intro text,
  add column if not exists plays_sections jsonb default '[]';

comment on column playbook_content.plays_intro is 'Optional intro for "The Plays Inside This Playbook" (e.g. "This playbook is organised into three sections...")';
comment on column playbook_content.plays_sections is 'Optional array of { title, description, plays: PlayItem[] }; when set, displayed instead of flat plays';
