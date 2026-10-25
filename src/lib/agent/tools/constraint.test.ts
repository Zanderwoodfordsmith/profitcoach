import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { type FunnelNumbers, pickConstraint } from "./constraint";

/** A coach with every stage healthy. */
const healthy: FunnelNumbers = {
  linkedin_connected: true,
  sales_robot: false,
  campaigns_running: 1,
  people_in_running_campaigns: 1_200,
  people_waiting_for_invite: 700,
  invites_30d: 400,
  accepted_of_invited_30d: 60,
  replied_of_invited_30d: 8,
  replies_30d: 12,
  interested_30d: 4,
  calls_booked_30d: 2,
  calls_booked_90d: 6,
  calls_booked_all_time: 10,
  clients_won_30d: 0,
  clients_won_90d: 1,
  active_clients: 3,
  capacity: 8,
};

const pick = (patch: Partial<FunnelNumbers>) => pickConstraint({ ...healthy, ...patch });

describe("constraint: the one stage holding them back", () => {
  it("is on track when nothing fails", () => {
    const v = pickConstraint(healthy);
    assert.equal(v.stage, "on_track");
    assert.deepEqual(v.missing, []);
  });

  it("puts a full diary first", () => {
    const v = pick({ active_clients: 8, calls_booked_90d: 9, clients_won_90d: 0 });
    assert.equal(v.stage, "delivery");
  });

  it("picks the stage furthest along that fails, not the top", () => {
    // Few invites, but plenty of interest and no calls: calls is the narrow point.
    const v = pick({ invites_30d: 35, replies_30d: 58, interested_30d: 19, calls_booked_30d: 0 });
    assert.equal(v.stage, "calls");
    assert.equal(v.open, "campaigns");
  });

  it("names each stage from its own numbers", () => {
    assert.equal(pick({ calls_booked_90d: 5, clients_won_90d: 0 }).stage, "clients");
    assert.equal(pick({ calls_booked_30d: 0 }).stage, "calls");
    assert.equal(pick({ replied_of_invited_30d: 2 }).stage, "replies");
    assert.equal(pick({ accepted_of_invited_30d: 30, replied_of_invited_30d: 5 }).stage, "accepts");
    assert.equal(pick({ people_waiting_for_invite: 150 }).open, "find-prospects");
    assert.equal(pick({ invites_30d: 150, accepted_of_invited_30d: 20 }).open, "campaigns");
    assert.equal(pick({ campaigns_running: 0 }).stage, "people");
    assert.equal(pick({ linkedin_connected: false }).open, "guide");
  });

  it("does not judge a stage with too little data", () => {
    const v = pick({ calls_booked_90d: 2, clients_won_90d: 0, replies_30d: 4, interested_30d: 1, calls_booked_30d: 0 });
    assert.equal(v.stage, "on_track");
    assert.equal(v.not_judged.length, 2);
  });

  it("says what is missing and asks before trusting a zero", () => {
    const v = pick({ capacity: null, calls_booked_30d: 0, calls_booked_90d: 0, calls_booked_all_time: 0, active_clients: 0, clients_won_90d: 0 });
    assert.equal(v.stage, "calls");
    assert.ok(v.check_first?.includes("somewhere else"));
    assert.equal(v.missing.length, 3);
  });
});
