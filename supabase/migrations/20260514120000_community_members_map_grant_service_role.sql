-- Members map API uses supabaseAdmin (service_role JWT). EXECUTE was only granted
-- to authenticated, which caused PostgREST to return permission denied → generic 500.

grant execute on function public.community_members_map() to service_role;
