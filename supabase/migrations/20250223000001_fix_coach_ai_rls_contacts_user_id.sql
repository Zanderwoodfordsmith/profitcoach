-- Ensure contacts has user_id (required by coach_chats RLS policies; from client_portal migration)
alter table contacts add column if not exists user_id uuid references auth.users(id);

-- Re-create coach_ai RLS policies that reference contacts.user_id (run this if the original migration failed with "column user_id does not exist")
drop policy if exists "Contacts can manage own coach_chats" on coach_chats;
create policy "Contacts can manage own coach_chats"
  on coach_chats for all
  to authenticated
  using (
    contact_id in (select id from contacts where user_id = auth.uid())
  )
  with check (
    contact_id in (select id from contacts where user_id = auth.uid())
  );

drop policy if exists "Service role can manage coach_chats" on coach_chats;
create policy "Service role can manage coach_chats"
  on coach_chats for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Contacts can manage messages in own chats" on coach_chat_messages;
create policy "Contacts can manage messages in own chats"
  on coach_chat_messages for all
  to authenticated
  using (
    chat_id in (
      select id from coach_chats
      where contact_id in (select id from contacts where user_id = auth.uid())
    )
  )
  with check (
    chat_id in (
      select id from coach_chats
      where contact_id in (select id from contacts where user_id = auth.uid())
    )
  );

drop policy if exists "Service role can manage coach_chat_messages" on coach_chat_messages;
create policy "Service role can manage coach_chat_messages"
  on coach_chat_messages for all
  to service_role
  using (true)
  with check (true);
