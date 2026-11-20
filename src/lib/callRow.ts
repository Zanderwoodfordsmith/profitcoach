export type CallRow = {
  id: string;
  contact_id: string | null;
  coach_id: string | null;
  coach_name: string | null;
  coach_business_name: string | null;
  prospect_name: string;
  prospect_email: string | null;
  prospect_phone: string | null;
  business_name: string | null;
  calendar_name: string | null;
  calendar_id: string | null;
  calendar_slug: string | null;
  title: string | null;
  status_normalized: string;
  status_raw: string | null;
  start_time: string | null;
  end_time: string | null;
  created_at: string | null;
  match_status: string;
  source: "native" | "ghl";
  meeting_join_url: string | null;
  zoom_recording_url: string | null;
  zoom_transcript_text: string | null;
  /** GHL calls only: the calendar's own status, before any coach mark. */
  ghl_status?: string;
  /** GHL calls only: completed or noshow when the coach marked it. */
  coach_outcome?: "completed" | "noshow" | null;
};
