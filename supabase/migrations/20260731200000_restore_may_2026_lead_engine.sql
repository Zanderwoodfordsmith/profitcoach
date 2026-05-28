-- May 2026 Lead Engine: conference make-up session (Fri 15 May, moved from Wed 13).
-- Restores the one-off removed by coach_calls_day_after_tuesday_recurrence cleanup.

INSERT INTO public.community_calendar_events (
  id,
  created_by,
  title,
  description,
  cover_image_url,
  starts_at,
  ends_at,
  display_timezone,
  location_kind,
  location_url,
  recording_link_url,
  recording_video_url,
  is_recurring,
  recurrence,
  access_tags
)
SELECT
  'ed3a5920-fabd-495d-8211-752f4263ced6'::uuid,
  e.created_by,
  e.title,
  e.description,
  e.cover_image_url,
  '2026-05-15T12:00:00+00'::timestamptz,
  '2026-05-15T14:00:00+00'::timestamptz,
  e.display_timezone,
  e.location_kind,
  e.location_url,
  null,
  null,
  false,
  null,
  e.access_tags
FROM public.community_calendar_events e
WHERE e.id = 'b984aa29-a933-4860-9c0b-c4ae7b65f67e'::uuid
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  cover_image_url = EXCLUDED.cover_image_url,
  starts_at = EXCLUDED.starts_at,
  ends_at = EXCLUDED.ends_at,
  display_timezone = EXCLUDED.display_timezone,
  location_kind = EXCLUDED.location_kind,
  location_url = EXCLUDED.location_url,
  is_recurring = false,
  recurrence = null,
  access_tags = EXCLUDED.access_tags,
  updated_at = now();
