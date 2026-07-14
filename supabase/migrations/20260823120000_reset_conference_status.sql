-- Conference has passed; clear attendance flags for the next cycle.
-- null = "Not set" in admin UI.
update public.coaches
set conference_status = null
where conference_status is not null;
