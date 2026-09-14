-- Cloud recording + transcript on native Zoom bookings.

alter table public.bookings
  add column if not exists zoom_recording_url text,
  add column if not exists zoom_transcript_text text;

comment on column public.bookings.zoom_recording_url is
  'Zoom cloud recording share URL for this booking.';
comment on column public.bookings.zoom_transcript_text is
  'Zoom audio transcript (VTT/text) when cloud transcription is enabled.';
