import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { orderCampaignsForDisplay } from "./campaignListOrder";

function row(
  id: string,
  updated_at: string,
  extra: {
    source_playbook_id?: string | null;
    list_order?: number | null;
    status?: string;
  } = {}
) {
  return {
    id,
    updated_at,
    status: extra.status ?? "paused",
    source_playbook_id: extra.source_playbook_id ?? null,
    list_order: extra.list_order,
  };
}

describe("orderCampaignsForDisplay", () => {
  it("keeps playbook order, then newest edits, until someone reorders", () => {
    const ordered = orderCampaignsForDisplay([
      row("custom", "2026-10-01T00:00:00.000Z"),
      row("nurture", "2026-01-01T00:00:00.000Z", {
        source_playbook_id: "vip-nurture",
      }),
      row("connector", "2026-01-02T00:00:00.000Z", {
        source_playbook_id: "vip-get-interest",
      }),
      row("newer", "2026-10-11T00:00:00.000Z"),
    ]);
    assert.deepEqual(
      ordered.map((campaign) => campaign.id),
      ["connector", "nurture", "newer", "custom"]
    );
  });

  it("uses list_order once any visible campaign has one", () => {
    const ordered = orderCampaignsForDisplay([
      row("connector", "2026-01-02T00:00:00.000Z", {
        source_playbook_id: "vip-get-interest",
        list_order: 2,
      }),
      row("custom", "2026-10-01T00:00:00.000Z", { list_order: 0 }),
      row("nurture", "2026-01-01T00:00:00.000Z", {
        source_playbook_id: "vip-nurture",
        list_order: 1,
      }),
    ]);
    assert.deepEqual(
      ordered.map((campaign) => campaign.id),
      ["custom", "nurture", "connector"]
    );
  });

  it("places campaigns without a saved order after the custom list", () => {
    const ordered = orderCampaignsForDisplay([
      row("saved", "2026-01-01T00:00:00.000Z", { list_order: 0 }),
      row("fresh", "2026-10-12T00:00:00.000Z"),
    ]);
    assert.deepEqual(
      ordered.map((campaign) => campaign.id),
      ["saved", "fresh"]
    );
  });
});
