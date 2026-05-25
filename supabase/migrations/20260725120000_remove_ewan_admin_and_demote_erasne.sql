-- Remove Ewan Rigby's admin account and demote Erasne Maquiling from admin.

update public.profiles
set role = 'coach'
where id = '77ec2136-b81f-4600-b994-cc75ab19a489'
  and role = 'admin';

delete from auth.users
where id = '5824520e-88f3-456b-93ca-96c9a477118b';
