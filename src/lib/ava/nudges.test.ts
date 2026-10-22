import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { diagnose } from "../coachHealth";
import { NUDGE_TEMPLATES, draftNudge, isStuck } from "./nudges";

const row = { name: "Sarah Chen", stuck_at: "", next_step: "Do the thing.", invites_7d: 12, accept_rate: 0.18, interested_30d: 4 };

describe("Ava nudges", () => {
  it("has a template for every stuck point coach health can give", () => {
    const stuckPoints = [
      "Not logging in",
      "LinkedIn not connected",
      "LinkedIn connection broken",
      "Not sending",
      "Blueprint not finished",
      "Sending too little",
      "Few people accept",
      "Interest isn't turning into calls",
      "Slow replies",
    ];
    for (const s of stuckPoints) assert.ok(NUDGE_TEMPLATES[s], s);
    assert.equal(Object.keys(NUDGE_TEMPLATES).length, stuckPoints.length);
    // diagnose() still uses these words (a rename there must update the templates).
    assert.equal(diagnose({ ...base(), last_active_days: 40 }).stuck_at, "Not logging in");
  });

  it("fills the coach's first name and numbers, with no em dashes", () => {
    const text = draftNudge({ ...row, stuck_at: "Few people accept" });
    assert.match(text, /^Hi Sarah,/);
    assert.match(text, /18%/);
    for (const key of Object.keys(NUDGE_TEMPLATES)) assert.ok(!draftNudge({ ...row, stuck_at: key }).includes("—"), key);
  });

  it("falls back to the next step for a new stuck point", () => {
    assert.equal(draftNudge({ ...row, stuck_at: "Something new" }), "Hi Sarah, it's Ava. Do the thing.");
  });

  it("only red and amber coaches are stuck", () => {
    assert.ok(isStuck({ level: "red" }));
    assert.ok(isStuck({ level: "amber" }));
    assert.ok(!isStuck({ level: "green" }));
  });
});

function base() {
  return {
    coach_id: "c",
    name: "Sarah Chen",
    slug: "sarah",
    last_active_days: 1,
    blueprint: "ready · 90%",
    linkedin: "connected" as const,
    ssi: 50,
    sales_robot: false,
    campaigns_running: 1,
    invites_7d: 120,
    invites_30d: 400,
    accept_rate: 0.4,
    replies_30d: 20,
    interested_30d: 5,
    calls_30d: 3,
    campaign_calls_30d: 1,
    days_to_first_call: 9,
    days_to_first_client: 40,
    median_reply_hours: 0.5,
    posts_30d: null,
    last_post_days: null,
    issues_90d: null,
  };
}
