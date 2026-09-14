import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getValidZoomAccessToken } from "@/lib/booking/zoomMeetings";
import {
  extractZoomRecordingShareUrl,
  extractZoomTranscriptDownloadUrl,
  type ParsedZoomRecordingCompleted,
  type ZoomRecordingObject,
} from "@/lib/zoomWebhook";

const MAX_TRANSCRIPT_CHARS = 200_000;

function isZoomDownloadHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "zoom.us" || host.endsWith(".zoom.us");
  } catch {
    return false;
  }
}

async function fetchTranscriptText(
  downloadUrl: string,
  downloadToken: string | null
): Promise<string | null> {
  if (!isZoomDownloadHost(downloadUrl)) return null;
  const headers: Record<string, string> = {};
  if (downloadToken) {
    headers.Authorization = `Bearer ${downloadToken}`;
  }
  const res = await fetch(downloadUrl, {
    headers,
    cache: "no-store",
    redirect: "follow",
  });
  if (!res.ok) {
    console.error("zoom transcript download failed:", res.status);
    return null;
  }
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_TRANSCRIPT_CHARS);
}

export async function attachZoomRecordingToBooking(input: {
  recording: ParsedZoomRecordingCompleted;
  downloadToken?: string | null;
}): Promise<{ ok: boolean; bookingId: string | null; reason: string | null }> {
  const meetingId = input.recording.meetingId;
  if (!meetingId) {
    return { ok: false, bookingId: null, reason: "missing_meeting_id" };
  }

  const { data: booking, error } = await supabaseAdmin
    .from("bookings")
    .select("id, zoom_recording_url, zoom_transcript_text")
    .eq("zoom_meeting_id", meetingId)
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !booking?.id) {
    return { ok: false, bookingId: null, reason: "unmatched" };
  }

  const patch: Record<string, string> = {};
    if (input.recording.shareUrl) {
      patch.zoom_recording_url = input.recording.shareUrl;
    }

  const hasTranscript =
    typeof booking.zoom_transcript_text === "string" &&
    booking.zoom_transcript_text.trim().length > 0;
  if (
    !hasTranscript &&
    input.recording.transcriptDownloadUrl &&
    input.downloadToken
  ) {
    const transcript = await fetchTranscriptText(
      input.recording.transcriptDownloadUrl,
      input.downloadToken
    );
    if (transcript) patch.zoom_transcript_text = transcript;
  }

  if (Object.keys(patch).length === 0) {
    return { ok: true, bookingId: String(booking.id), reason: "already_set" };
  }

  const { error: updateError } = await supabaseAdmin
    .from("bookings")
    .update(patch)
    .eq("id", booking.id);
  if (updateError) {
    console.error("zoom booking recording update:", updateError.message);
    return { ok: false, bookingId: String(booking.id), reason: "save_failed" };
  }
  return { ok: true, bookingId: String(booking.id), reason: null };
}

type ZoomApiRecording = {
  share_url?: string;
  recording_files?: Array<{
    file_type?: string;
    recording_type?: string;
    share_url?: string;
    play_url?: string;
    download_url?: string;
  }>;
};

export async function hydrateBookingZoomRecording(input: {
  coachId: string;
  meetingId: string;
  bookingId: string;
}): Promise<{
  recordingUrl: string | null;
  transcriptText: string | null;
}> {
  const accessToken = await getValidZoomAccessToken(input.coachId);
  if (!accessToken) {
    return { recordingUrl: null, transcriptText: null };
  }

  const res = await fetch(
    `https://api.zoom.us/v2/meetings/${encodeURIComponent(input.meetingId)}/recordings`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    }
  );
  if (!res.ok) {
    return { recordingUrl: null, transcriptText: null };
  }

  const data = (await res.json()) as ZoomApiRecording;
  const object = {
    id: input.meetingId,
    share_url: data.share_url,
    recording_files: data.recording_files,
  } as ZoomRecordingObject;
  const shareUrl = extractZoomRecordingShareUrl(object);
  const transcriptUrl = extractZoomTranscriptDownloadUrl(object);
  let transcript: string | null = null;
  if (transcriptUrl) {
    transcript = await fetchTranscriptText(transcriptUrl, accessToken);
  }

  const patch: Record<string, string> = {};
  if (shareUrl) patch.zoom_recording_url = shareUrl;
  if (transcript) patch.zoom_transcript_text = transcript;
  if (Object.keys(patch).length > 0) {
    await supabaseAdmin.from("bookings").update(patch).eq("id", input.bookingId);
  }

  return {
    recordingUrl: shareUrl,
    transcriptText: transcript,
  };
}
