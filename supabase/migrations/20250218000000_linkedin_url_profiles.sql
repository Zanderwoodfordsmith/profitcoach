-- Ensure profiles has linkedin_url for coach attribution (idempotent)
alter table profiles add column if not exists linkedin_url text;
