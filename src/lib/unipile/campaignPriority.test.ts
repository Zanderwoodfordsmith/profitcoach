import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CAMPAIGN_PRIORITY,
  campaignPriorityLevelFromStored,
  campaignPriorityValues,
} from "./campaignPriority";

describe("campaignPriorityValues", () => {
  it("gives high campaigns first run order and the largest invite share", () => {
    assert.deepEqual(campaignPriorityValues("high"), {
      outreach_priority: 1,
      outreach_weight: 3,
    });
    assert.equal(campaignPriorityValues("medium").outreach_weight, 2);
    assert.equal(campaignPriorityValues("low").outreach_weight, 1);
    assert.ok(
      CAMPAIGN_PRIORITY.high.outreach_priority <
        CAMPAIGN_PRIORITY.medium.outreach_priority
    );
    assert.ok(
      CAMPAIGN_PRIORITY.medium.outreach_priority <
        CAMPAIGN_PRIORITY.low.outreach_priority
    );
  });
});

describe("campaignPriorityLevelFromStored", () => {
  it("defaults unset values to medium", () => {
    assert.equal(campaignPriorityLevelFromStored(null, null), "medium");
    assert.equal(
      campaignPriorityLevelFromStored(undefined, undefined),
      "medium"
    );
  });

  it("round-trips the three-level pairs", () => {
    assert.equal(
      campaignPriorityLevelFromStored(
        CAMPAIGN_PRIORITY.high.outreach_priority,
        CAMPAIGN_PRIORITY.high.outreach_weight
      ),
      "high"
    );
    assert.equal(
      campaignPriorityLevelFromStored(
        CAMPAIGN_PRIORITY.medium.outreach_priority,
        CAMPAIGN_PRIORITY.medium.outreach_weight
      ),
      "medium"
    );
    assert.equal(
      campaignPriorityLevelFromStored(
        CAMPAIGN_PRIORITY.low.outreach_priority,
        CAMPAIGN_PRIORITY.low.outreach_weight
      ),
      "low"
    );
  });

  it("maps legacy sliders: first-run and heavier share as high", () => {
    assert.equal(campaignPriorityLevelFromStored(1, 1), "high");
    assert.equal(campaignPriorityLevelFromStored(10, 5), "high");
    assert.equal(campaignPriorityLevelFromStored(80, 1), "low");
    assert.equal(campaignPriorityLevelFromStored(50, 1), "medium");
  });
});
