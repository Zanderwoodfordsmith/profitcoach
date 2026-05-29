-- Allow admins to delete in-app feedback/feature requests.

drop policy if exists "Admins delete community feedback reports"
  on public.community_feedback_reports;
create policy "Admins delete community feedback reports"
  on public.community_feedback_reports for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );
