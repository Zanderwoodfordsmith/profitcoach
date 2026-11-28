import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { diagnose, isCurrentCoach } from "./coachHealth";

const base = {
  coach_id: "c",
  name: "Coach",
  slug: "coach",
  last_active_days: 1,
  blueprint: "complete · 90%",
  linkedin: "connected" as const,
  ssi: 60,
  campaigns_running: 1,
  invites_7d: 120,
  invites_30d: 480,
  accept_rate: 0.25,
  replies_30d: 30,
  interested_30d: 6,
  calls_30d: 3,
  campaign_calls_30d: 1,
  days_to_first_call: 9,
  days_to_first_client: 40,
  posts_30d: 8,
  last_post_days: 2,
  issues_90d: 4,
  median_reply_hours: 0.5,
  days_since_launch: 60,
  interested_since_launch: 12,
};

describe("coach health: fix first", () => {
  it("is on track when the numbers are healthy", () => {
    assert.equal(diagnose(base).level, "green");
  });
  it("picks the first blocker in order", () => {
    assert.equal(diagnose({ ...base, last_active_days: 20, linkedin: "none" }).stuck_at, "Not logging in");
    assert.equal(diagnose({ ...base, linkedin: "none" }).stuck_at, "LinkedIn not connected");
    assert.equal(diagnose({ ...base, invites_7d: 0, campaigns_running: 0 }).stuck_at, "Not sending");
    assert.equal(diagnose({ ...base, invites_30d: 120 }).stuck_at, "Sending too little");
    assert.equal(diagnose({ ...base, accept_rate: 0.06 }).stuck_at, "Few people accept");
    assert.equal(diagnose({ ...base, days_since_launch: 15, interested_since_launch: 0 }).stuck_at, "No interest 14 days after launch");
    assert.equal(diagnose({ ...base, days_since_launch: 10, interested_since_launch: 0 }).level, "green");
    assert.equal(diagnose({ ...base, calls_30d: 0 }).stuck_at, "Interest isn't turning into calls");
    assert.equal(diagnose({ ...base, median_reply_hours: 9 }).stuck_at, "Slow replies");
  });
});

describe("coach health: who counts as a current coach", () => {
  const row = { membership_status: null, recurring_payment_status: null, access_tier: "premium", record_kind: "member" };
  it("counts live Stripe members", () => {
    assert.equal(isCurrentCoach({ ...row, membership_status: "active" }), true);
    assert.equal(isCurrentCoach({ ...row, membership_status: "canceled" }), false);
  });
  it("counts new Programme coaches who paid their first 6 months outside Stripe", () => {
    assert.equal(isCurrentCoach({ ...row, recurring_payment_status: "first_6_months", access_tier: "programme" }), true);
    assert.equal(isCurrentCoach({ ...row, recurring_payment_status: "first_6_months", access_tier: "premium" }), false);
    assert.equal(isCurrentCoach({ ...row, recurring_payment_status: "first_6_months", access_tier: "programme", record_kind: "historical" }), false);
  });
});
