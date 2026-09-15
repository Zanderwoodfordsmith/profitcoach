import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CallRow } from "../callRow";
import { callMatchesSearch } from "./callSearch";

function row(overrides: Partial<CallRow> = {}): CallRow {
  return {
    id: "1",
    contact_id: null,
    coach_id: null,
    coach_name: null,
    coach_business_name: null,
    prospect_name: "Ada Lovelace",
    prospect_email: "ada@example.com",
    prospect_phone: null,
    business_name: "Analytical Engines",
    calendar_name: "Strategy call",
    calendar_id: null,
    calendar_slug: null,
    title: "Strategy call",
    status_normalized: "confirmed",
    status_raw: "booked",
    start_time: "2026-09-15T10:00:00.000Z",
    end_time: null,
    created_at: "2026-09-01T09:00:00.000Z",
    match_status: "matched",
    source: "native",
    meeting_join_url: null,
    zoom_recording_url: null,
    zoom_transcript_text: null,
    ...overrides,
  };
}

describe("callMatchesSearch", () => {
  it("matches name, email, and calendar", () => {
    assert.equal(callMatchesSearch(row(), "ada"), true);
    assert.equal(callMatchesSearch(row(), "example.com"), true);
    assert.equal(callMatchesSearch(row(), "strategy"), true);
    assert.equal(callMatchesSearch(row(), "nobody"), false);
  });

  it("treats blank search as a match", () => {
    assert.equal(callMatchesSearch(row(), "   "), true);
  });
});
