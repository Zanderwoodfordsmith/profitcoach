alter table public.coaches
add column if not exists conference_status text;

alter table public.coaches
drop constraint if exists coaches_conference_status_check;

alter table public.coaches
add constraint coaches_conference_status_check
check (conference_status is null or conference_status in ('no', 'maybe', 'yes'));

comment on column public.coaches.conference_status is
  'Admin-only conference attendance status: no, maybe, or yes.';

with target_names(name) as (
  values
    ('andy blocke'),
    ('andy mclachlan'),
    ('brian murray'),
    ('charles conroy'),
    ('dan oosthuizen'),
    ('daniel mirwis'),
    ('derek hollingdale'),
    ('eugene james'),
    ('graham withe'),
    ('hilary mcnair'),
    ('ian finney'),
    ('james baker'),
    ('james ahearne'),
    ('james fenner'),
    ('john mccarthy'),
    ('luke biddle'),
    ('matt beevers'),
    ('nathan siekierski'),
    ('patrick riley'),
    ('paul wainwright'),
    ('peter buglass'),
    ('spencer thomas'),
    ('terence monaghan'),
    ('will walsh')
)
update public.coaches c
set conference_status = 'yes'
from public.profiles p
join target_names tn
  on lower(trim(regexp_replace(p.full_name, '\s+', ' ', 'g'))) = tn.name
where p.id = c.id;
