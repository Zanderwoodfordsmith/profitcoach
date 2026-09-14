-- Optional named audience list created alongside a pool bulk import.

alter table public.sales_nav_import_runs
  add column if not exists save_list_id uuid
    references public.coach_lead_lists (id) on delete set null;

alter table public.google_maps_import_runs
  add column if not exists save_list_id uuid
    references public.coach_lead_lists (id) on delete set null;

comment on column public.sales_nav_import_runs.save_list_id is
  'Optional audience list that also receives this Sales Nav import snapshot.';

comment on column public.google_maps_import_runs.save_list_id is
  'Optional audience list that also receives this Google Maps import.';
