-- Add first_name, last_name, phone to contacts for landing multi-step form.
-- full_name is kept; app sets full_name from first_name + ' ' + last_name when creating from landing.
alter table contacts add column if not exists first_name text;
alter table contacts add column if not exists last_name text;
alter table contacts add column if not exists phone text;
