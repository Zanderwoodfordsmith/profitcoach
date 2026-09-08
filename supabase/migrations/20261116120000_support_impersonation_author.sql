-- Support tickets: honor admin → coach impersonation (demo coach toggle).
-- Same pattern as community posts: admin may insert as another coach/admin profile.

drop policy if exists "Staff insert own community feedback reports"
  on public.community_feedback_reports;

create policy "Staff insert own community feedback reports"
  on public.community_feedback_reports for insert
  to authenticated
  with check (
    (
      public.is_staff_community()
      and created_by = auth.uid()
    )
    or (
      exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.role = 'admin'
      )
      and exists (
        select 1 from public.profiles owner
        where owner.id = created_by
          and owner.role in ('coach', 'admin')
      )
    )
  );

drop policy if exists "Ticket participants insert feedback replies"
  on public.community_feedback_replies;

create policy "Ticket participants insert feedback replies"
  on public.community_feedback_replies for insert
  to authenticated
  with check (
    (
      created_by = auth.uid()
      and (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and p.role = 'admin'
        )
        or exists (
          select 1 from public.community_feedback_reports r
          where r.id = report_id
            and r.created_by = auth.uid()
        )
      )
    )
    or (
      exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.role = 'admin'
      )
      and exists (
        select 1 from public.profiles author
        where author.id = created_by
          and author.role in ('coach', 'admin')
      )
    )
  );

-- Admins marking tickets read while viewing as a coach (created_by = persona).
create or replace function public.mark_support_ticket_read(p_report_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  update public.community_feedback_reports
  set coach_last_read_at = now()
  where id = p_report_id
    and (
      created_by = auth.uid()
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.role = 'admin'
      )
    );
end;
$fn$;
