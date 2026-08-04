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

function baseEvent(
  overrides: Partial<CommunityCalendarEventRow> &
    Pick<CommunityCalendarEventRow, "id" | "title" | "starts_at" | "ends_at">
): CommunityCalendarEventRow {
  return {
    created_by: "user-1",
    description: "",
    cover_image_url: null,
    display_timezone: "Europe/London",
    location_kind: "link",
    location_url: "https://businesscoachacademy.com/calls",
    recording_link_url: null,
    recording_video_url: null,
    is_recurring: true,
    recurrence: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// Wide window: 4pm London recording should still attach to a 1pm London PCT slot.
{
  const pct = baseEvent({
    id: "pct-1",
    title: "Profit Coach Training",
    starts_at: "2026-07-30T12:00:00.000Z", // 13:00 London
    ends_at: "2026-07-30T13:00:00.000Z",
  });
  const pctOccs = expandCommunityCalendar(
    [pct],
    DateTime.fromISO("2026-07-28T00:00:00.000Z", { zone: "utc" }),
    DateTime.fromISO("2026-08-01T00:00:00.000Z", { zone: "utc" })
  );
  const lateMatch = findBestCalendarOccurrenceForZoomRecording([pct], pctOccs, {
    meetingId: null,
    startTimeIso: "2026-07-30T15:00:00.000Z", // 16:00 London
  });
  assert(
    Boolean(lateMatch && !("ambiguous" in lateMatch)),
    "wide window matches 4pm recording to 1pm calendar slot"
  );
  if (lateMatch && !("ambiguous" in lateMatch)) {
    assert(lateMatch.occurrence.eventId === "pct-1", "wide window chose PCT");
  }
}

// First Monday: first recording → Monthly Momentum, second → Win The Week.
{
  const momentum = baseEvent({
    id: "mm-1",
    title: "Monthly Momentum",
    starts_at: "2026-08-03T14:30:00.000Z", // 15:30 London
    ends_at: "2026-08-03T15:00:00.000Z",
  });
  const wtw = baseEvent({
    id: "wtw-1",
    title: "Win The Week",
    starts_at: "2026-08-03T15:00:00.000Z", // 16:00 London
    ends_at: "2026-08-03T16:00:00.000Z",
  });
  const mondayEvents = [momentum, wtw];
  const mondayOccs = expandCommunityCalendar(
    mondayEvents,
    DateTime.fromISO("2026-08-01T00:00:00.000Z", { zone: "utc" }),
    DateTime.fromISO("2026-08-05T00:00:00.000Z", { zone: "utc" })
  );

  const first = findBestCalendarOccurrenceForZoomRecording(mondayEvents, mondayOccs, {
    meetingId: null,
    startTimeIso: "2026-08-03T14:35:00.000Z",
  });
  assert(
    Boolean(first && !("ambiguous" in first) && first.occurrence.eventId === "mm-1"),
    "first Monday first recording attaches to Monthly Momentum"
  );

  const mondayOccsAfterFirst = mondayOccs.map((occ) =>
    occ.eventId === "mm-1"
      ? {
          ...occ,
          recording_link_url: "https://zoom.us/rec/share/momentum",
        }
      : occ
  );
  const second = findBestCalendarOccurrenceForZoomRecording(
    mondayEvents,
    mondayOccsAfterFirst,
    {
      meetingId: null,
      startTimeIso: "2026-08-03T15:05:00.000Z",
    }
  );
  assert(
    Boolean(
      second && !("ambiguous" in second) && second.occurrence.eventId === "wtw-1"
    ),
    "first Monday second recording attaches to Win The Week"
  );

  // Mirrored WTW (same link as Momentum) is replaceable by a second recording.
  const mondayOccsMirrored = mondayOccs.map((occ) => {
    if (occ.eventId === "mm-1" || occ.eventId === "wtw-1") {
      return {
        ...occ,
        recording_link_url: "https://zoom.us/rec/share/combined",
      };
    }
    return occ;
  });
  const secondAfterMirror = findBestCalendarOccurrenceForZoomRecording(
    mondayEvents,
    mondayOccsMirrored,
    {
      meetingId: null,
      startTimeIso: "2026-08-03T15:05:00.000Z",
    }
  );
  assert(
    Boolean(
      secondAfterMirror &&
        !("ambiguous" in secondAfterMirror) &&
        secondAfterMirror.occurrence.eventId === "wtw-1"
    ),
    "second recording replaces mirrored Win The Week link"
  );
}

console.log("\nAll Zoom recording webhook checks passed.");
