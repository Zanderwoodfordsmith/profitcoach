/**
 * Smoke tests for Zoom recording webhook parsing and calendar matching.
 * Run: npx tsx scripts/test-zoom-recording-webhook.ts
 */
import { createHmac } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";
import { DateTime } from "luxon";

import { expandCommunityCalendar } from "../src/lib/communityCalendarExpand";
import type {
  CommunityCalendarEventRow,
  CommunityCalendarOccurrence,
} from "../src/lib/communityCalendarTypes";
import {
  buildZoomUrlValidationResponse,
  extractZoomMeetingIdFromUrl,
  extractZoomRecordingShareUrl,
  parseZoomRecordingCompletedPayload,
  verifyZoomWebhookSignature,
} from "../src/lib/zoomWebhook";
import { findBestCalendarOccurrenceForZoomRecording } from "../src/lib/zoomRecordingCalendarSync";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error("FAIL:", message);
    process.exit(1);
  }
  console.log("OK:", message);
}

assert(
  extractZoomMeetingIdFromUrl("https://us02web.zoom.us/j/81234567890?pwd=abc") ===
    "81234567890",
  "extract meeting id from zoom join url"
);

const fixturePath = join(
  process.cwd(),
  "scripts/fixtures/zoom-recording-completed-sample.json"
);
const sample = JSON.parse(readFileSync(fixturePath, "utf8"));
const parsed = parseZoomRecordingCompletedPayload(sample);
assert(!("error" in parsed), "parse sample recording.completed payload");
if (!("error" in parsed)) {
  assert(parsed.meetingId === "81234567890", "meeting id parsed");
  assert(
    parsed.shareUrl === "https://zoom.us/rec/share/sample-recording-share-url",
    "share url parsed"
  );
}

const shareUrl = extractZoomRecordingShareUrl(sample.payload.object);
assert(
  shareUrl === "https://zoom.us/rec/share/sample-recording-share-url",
  "extract share url from object"
);

const secret = "test-secret-token";
const timestamp = "1719859200";
const rawBody = JSON.stringify(sample);
const signatureHeader = `v0=${createHmac("sha256", secret)
  .update(`v0:${timestamp}:${rawBody}`)
  .digest("hex")}`;
assert(
  verifyZoomWebhookSignature(rawBody, timestamp, signatureHeader, secret),
  "verify webhook signature"
);

const validation = buildZoomUrlValidationResponse("plain-token", secret);
assert(
  validation.plainToken === "plain-token" && validation.encryptedToken.length === 64,
  "build url validation response"
);

const event: CommunityCalendarEventRow = {
  id: "event-1",
  created_by: "user-1",
  title: "Wednesday Coach Call",
  description: "",
  cover_image_url: null,
  starts_at: "2026-06-25T13:00:00.000Z",
  ends_at: "2026-06-25T14:00:00.000Z",
  display_timezone: "Europe/London",
  location_kind: "link",
  location_url: "https://us02web.zoom.us/j/81234567890",
  recording_link_url: null,
  recording_video_url: null,
  is_recurring: false,
  recurrence: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const occurrences: CommunityCalendarOccurrence[] = expandCommunityCalendar(
  [event],
  DateTime.fromISO("2026-06-24T00:00:00.000Z", { zone: "utc" }),
  DateTime.fromISO("2026-06-26T23:59:59.999Z", { zone: "utc" })
);

if (!("error" in parsed)) {
  const match = findBestCalendarOccurrenceForZoomRecording(
    [event],
    occurrences,
    parsed
  );
  assert(Boolean(match && !("ambiguous" in match)), "match recording to calendar event");
  if (match && !("ambiguous" in match)) {
    assert(
      match.occurrence.eventId === "event-1",
      "matched the expected calendar event"
    );
  }
}

console.log("\nAll Zoom recording webhook checks passed.");
