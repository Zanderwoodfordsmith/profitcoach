-- Edit, delete, and assign on Blueprint section comments.
-- assignee_id is the coach or a BCA admin who should deal with the comment.
-- updated_at is set only when the author changes the wording.

alter table public.practice_section_comments
  add column if not exists assignee_id uuid references public.profiles(id) on delete set null,
  add column if not exists updated_at timestamptz;
