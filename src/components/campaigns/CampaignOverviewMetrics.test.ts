import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { campaignStatusMix } from "./CampaignOverviewMetrics";

describe("campaign status mix", () => {
  it("keeps pipeline order and drops empty statuses", () => {
    const rows = campaignStatusMix({
      replied: 4,
      queued: 12,
      failed: 1,
      invited: 0,
    });
    assert.deepEqual(
      rows.map((row) => row.status),
      ["queued", "replied", "failed"]
    );
    assert.equal(rows[0]?.label, "Queued");
    assert.equal(rows[1]?.label, "Replied");
  });

  it("appends unknown statuses after the pipeline", () => {
    const rows = campaignStatusMix({ queued: 2, custom_hold: 3 });
    assert.deepEqual(
      rows.map((row) => row.status),
      ["queued", "custom_hold"]
    );
    assert.ok(rows[1]?.color);
  });
});
