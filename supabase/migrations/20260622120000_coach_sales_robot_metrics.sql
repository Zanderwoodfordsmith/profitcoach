alter table public.coaches
add column if not exists sales_robot_active_campaigns integer,
add column if not exists sales_robot_paying_accounts integer;

comment on column public.coaches.sales_robot_active_campaigns is
  'Admin-only: active Sales Robot campaign count from customer export.';

comment on column public.coaches.sales_robot_paying_accounts is
  'Admin-only: paying Sales Robot accounts count from customer export.';
