import { createHmac, timingSafeEqual } from "crypto";

export type ZoomWebhookEnvelope = {
  event?: string;
  event_ts?: number;
  payload?: {
    plainToken?: string;
    account_id?: string;
    object?: ZoomRecordingObject;
  };
  download_token?: string;
};

export type ZoomRecordingFile = {
  file_type?: string;
  recording_type?: string;
  share_url?: string;
  play_url?: string;
  recording_start?: string;
  recording_end?: string;
};

export type ZoomRecordingObject = {
  id?: number | string;
  uuid?: string;
  topic?: string;
  start_time?: string;
  duration?: number;
  share_url?: string;
  recording_files?: ZoomRecordingFile[];
};

const HTTP_URL_RE = /^https?:\/\//i;

function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

export function verifyZoomWebhookSignature(
  rawBody: string,
  timestamp: string | null,
  signature: string | null,
  secret: string
): boolean {
  if (!timestamp || !signature || !secret) return false;
  const message = `v0:${timestamp}:${rawBody}`;
  const hash = createHmac("sha256", secret).update(message).digest("hex");
  return secureCompare(`v0=${hash}`, signature);
}

export function buildZoomUrlValidationResponse(
  plainToken: string,
  secret: string
): { plainToken: string; encryptedToken: string } {
  const encryptedToken = createHmac("sha256", secret)
    .update(plainToken)
    .digest("hex");
  return { plainToken, encryptedToken };
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function asHttpUrl(value: unknown): string | null {
  const trimmed = asTrimmedString(value);
  if (!trimmed || !HTTP_URL_RE.test(trimmed)) return null;
  try {
    return new URL(trimmed).toString();
  } catch {
    return null;
  }
}

export function extractZoomMeetingId(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }
  const trimmed = asTrimmedString(value);
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) return trimmed;
  return null;
}

/** Extract a numeric Zoom meeting ID from common join links. */
export function extractZoomMeetingIdFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const pathMatch = parsed.pathname.match(/\/(?:j|w)\/(\d+)/);
    return pathMatch?.[1] ?? null;
  } catch {
    return null;
  }
}

export function extractZoomRecordingShareUrl(
  object: ZoomRecordingObject
): string | null {
  const topLevel = asHttpUrl(object.share_url);
  if (topLevel) return topLevel;

  const files = object.recording_files ?? [];
  const preferred = files.filter(
    (file) =>
      file.file_type === "MP4" ||
      (typeof file.recording_type === "string" &&
        file.recording_type.includes("shared_screen"))
  );
  const candidates = preferred.length > 0 ? preferred : files;

  for (const file of candidates) {
    const share = asHttpUrl(file.share_url);
    if (share) return share;
    const play = asHttpUrl(file.play_url);
    if (play) return play;
  }

  return null;
}

export type ParsedZoomRecordingCompleted = {
  accountId: string | null;
  meetingId: string | null;
  meetingUuid: string | null;
  topic: string | null;
  startTimeIso: string;
  shareUrl: string;
};

export function parseZoomRecordingCompletedPayload(
  body: ZoomWebhookEnvelope
): ParsedZoomRecordingCompleted | { error: string } {
  const object = body.payload?.object;
  if (!object || typeof object !== "object") {
    return { error: "Missing recording payload object." };
  }

  const shareUrl = extractZoomRecordingShareUrl(object);
  if (!shareUrl) {
    return { error: "Recording payload did not include a share URL." };
  }

  const startTimeIso = asTrimmedString(object.start_time);
  if (!startTimeIso || Number.isNaN(Date.parse(startTimeIso))) {
    return { error: "Recording payload did not include a valid start_time." };
  }

  return {
    accountId: asTrimmedString(body.payload?.account_id),
    meetingId: extractZoomMeetingId(object.id),
    meetingUuid: asTrimmedString(object.uuid),
    topic: asTrimmedString(object.topic),
    startTimeIso,
    shareUrl,
  };
}
