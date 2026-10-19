-- Vault programme worksheets (StryvX first). Their own area keeps them out of
-- the Resources tab, which lists coach-delivery and profit-system only; they
-- show on the lessons they are linked to through academy_lesson_resources.

alter table public.academy_resource_sections
  drop constraint if exists academy_resource_sections_area_check;

alter table public.academy_resource_sections
  add constraint academy_resource_sections_area_check
  check (area in ('coach-delivery', 'profit-system', 'vault'));

insert into public.academy_resource_sections (id, area, parent_id, title, sort_order)
values ('vault/stryvx', 'vault', null, 'StryvX worksheets', 0)
on conflict (id) do nothing;
