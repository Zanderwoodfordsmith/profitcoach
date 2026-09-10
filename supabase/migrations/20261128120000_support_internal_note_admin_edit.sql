-- Admins can edit support ticket internal notes; track edits.

alter table public.support_ticket_internal_notes
  add column if not exists edited_at timestamptz;

comment on column public.support_ticket_internal_notes.edited_at is
  'Set when an admin edits the note body; null means never edited.';

drop policy if exists "Admins update support ticket internal notes"
  on public.support_ticket_internal_notes;
create policy "Admins update support ticket internal notes"
  on public.support_ticket_internal_notes
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create or replace function public.touch_support_internal_note_edited_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.body is distinct from old.body then
    new.edited_at := now();
  end if;
  return new;
end;
$fn$;

drop trigger if exists support_ticket_internal_notes_touch_edited_at_trg
  on public.support_ticket_internal_notes;
create trigger support_ticket_internal_notes_touch_edited_at_trg
before update of body on public.support_ticket_internal_notes
for each row
execute function public.touch_support_internal_note_edited_at();
