-- Title-case coach person names so ALL CAPS (e.g. YAIR) becomes Yair.
-- Strips leading Mr / Mrs / Miss / Ms; keeps Dr.
-- Matches src/lib/formatPersonName.ts.

create or replace function public.format_person_name(p_value text)
returns text
language plpgsql
immutable
as $$
declare
  trimmed text;
  words text[];
  parts text[];
  word text;
  part text;
  i int;
  j int;
  start_idx int := 1;
begin
  if p_value is null then
    return null;
  end if;

  trimmed := btrim(p_value);
  if trimmed = '' then
    return '';
  end if;

  words := regexp_split_to_array(trimmed, '\s+');

  -- Drop leading Mr / Mrs / Miss / Ms (with optional period). Keep Dr.
  while start_idx <= coalesce(array_length(words, 1), 0)
    and lower(regexp_replace(words[start_idx], '\.$', '')) in ('mr', 'mrs', 'miss', 'ms')
  loop
    start_idx := start_idx + 1;
  end loop;

  if start_idx > coalesce(array_length(words, 1), 0) then
    return '';
  end if;

  for i in start_idx .. array_length(words, 1) loop
    word := words[i];
    parts := string_to_array(word, '-');
    for j in 1 .. coalesce(array_length(parts, 1), 0) loop
      part := parts[j];
      if part is not null and part <> '' then
        parts[j] := upper(left(part, 1)) || lower(substr(part, 2));
      end if;
    end loop;
    words[i] := array_to_string(parts, '-');
  end loop;

  return array_to_string(words[start_idx : array_length(words, 1)], ' ');
end;
$$;

update public.profiles as p
set
  first_name = nullif(public.format_person_name(p.first_name), ''),
  last_name = nullif(public.format_person_name(p.last_name), ''),
  full_name = nullif(public.format_person_name(p.full_name), '')
from public.coaches as c
where p.id = c.id
  and (
    p.first_name is distinct from nullif(public.format_person_name(p.first_name), '')
    or p.last_name is distinct from nullif(public.format_person_name(p.last_name), '')
    or p.full_name is distinct from nullif(public.format_person_name(p.full_name), '')
  );

drop function public.format_person_name(text);
