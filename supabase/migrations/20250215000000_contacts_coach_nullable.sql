-- Allow contacts to have no coach (e.g. admin-created unassigned clients)
alter table contacts alter column coach_id drop not null;
