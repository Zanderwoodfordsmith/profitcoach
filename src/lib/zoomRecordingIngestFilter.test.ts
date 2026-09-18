import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  COMMUNITY_ZOOM_RECORDING_MEETING_ID,
  communityZoomRecordingAllowedMeetingIds,
  evaluateCommunityZoomRecordingIngest,
} from "./zoomRecordingIngestFilter";

const allowedMeetingIds = communityZoomRecordingAllowedMeetingIds("");

function ingest(
  overrides: Partial<{
    meetingId: string | null;
    startTimeIso: string;
    durationMinutes: number | null;
  }> = {}
) {
  return evaluateCommunityZoomRecordingIngest(
    {
      meetingId: COMMUNITY_ZOOM_RECORDING_MEETING_ID,
      // 16:00 Europe/London in BST
      startTimeIso: "2026-09-17T15:00:00.000Z",
      durationMinutes: 62,
      ...overrides,
    },
    { allowedMeetingIds }
  );
}

describe("communityZoomRecordingAllowedMeetingIds", () => {
  it("always includes the support personal room", () => {
    assert.equal(allowedMeetingIds.has(COMMUNITY_ZOOM_RECORDING_MEETING_ID), true);
  });
});

describe("evaluateCommunityZoomRecordingIngest", () => {
  it("accepts a 4pm London call in the support room", () => {
    assert.deepEqual(ingest(), { ok: true });
  });

  it("accepts Monthly Momentum at 3:30pm London", () => {
    assert.deepEqual(
      ingest({ startTimeIso: "2026-08-03T14:30:00.000Z" }),
      { ok: true }
    );
  });

  it("rejects a missing meeting id", () => {
    const result = ingest({ meetingId: null });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "meeting_not_allowed");
  });

  it("rejects a different personal room", () => {
    const result = ingest({ meetingId: "7540888016" });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "meeting_not_allowed");
  });

  it("accepts the support PMI with spaces", () => {
    assert.deepEqual(ingest({ meetingId: "798 126 9644" }), { ok: true });
  });

  it("rejects a morning meeting in the support room", () => {
    const result = ingest({ startTimeIso: "2026-09-17T09:00:00.000Z" });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "outside_call_window");
  });

  it("rejects a short accidental recording", () => {
    const result = ingest({ durationMinutes: 5 });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "duration_out_of_range");
  });

  it("allows missing duration", () => {
    assert.deepEqual(ingest({ durationMinutes: null }), { ok: true });
  });
});
