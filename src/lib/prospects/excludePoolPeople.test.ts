import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { excludePoolOnlyContacts, isStillInPool } from "./excludePoolPeople";

describe("excludePoolOnlyContacts", () => {
  const poolIds = new Set(["pool-1", "pool-2"]);

  it("keeps people added as prospects even at Pool status", () => {
    assert.equal(
      isStillInPool(
        { id: "manual", prospect_status: "leads", prospect_source: "manual" },
        poolIds
      ),
      false
    );
    assert.equal(
      isStillInPool(
        { id: "booked-form", prospect_status: "leads", prospect_source: "booking" },
        poolIds
      ),
      false
    );
  });

  it("drops pool-linked people still at Pool / leads", () => {
    assert.equal(
      isStillInPool({ id: "pool-1", prospect_status: "leads" }, poolIds),
      true
    );
    assert.equal(
      isStillInPool({ id: "pool-2", prospect_status: null }, poolIds),
      true
    );
  });

  it("keeps scorecard fills even when stored as lead_capture / funnel", () => {
    assert.equal(
      isStillInPool(
        {
          id: "capture",
          prospect_status: "leads",
          prospect_source: "lead_capture",
        },
        new Set()
      ),
      false
    );
    assert.equal(
      isStillInPool(
        {
          id: "scorecard",
          prospect_status: "leads",
          prospect_source: null,
          prospect_funnel: "boss_scorecard",
        },
        new Set()
      ),
      false
    );
  });

  it("keeps legacy added prospects with no source", () => {
    assert.equal(
      isStillInPool(
        { id: "legacy", prospect_status: "new", prospect_source: null },
        new Set()
      ),
      false
    );
  });

  it("drops campaign / list-import leads that are still at Pool", () => {
    assert.equal(
      isStillInPool(
        {
          id: "campaign",
          prospect_status: null,
          prospect_source: "linkedin_campaign",
        },
        new Set()
      ),
      true
    );
    assert.equal(
      isStillInPool(
        {
          id: "sales-nav",
          prospect_status: "leads",
          prospect_source: "sales_nav",
        },
        new Set()
      ),
      true
    );
  });

  it("keeps pool people who have progressed", () => {
    assert.equal(
      isStillInPool({ id: "pool-1", prospect_status: "replied" }, poolIds),
      false
    );
    assert.equal(
      isStillInPool(
        {
          id: "campaign",
          prospect_status: "interested",
          prospect_source: "linkedin_campaign",
        },
        new Set()
      ),
      false
    );
  });

  it("filters a mixed list", () => {
    const rows = excludePoolOnlyContacts(
      [
        { id: "manual", prospect_status: "leads", prospect_source: "manual" },
        { id: "pool-1", prospect_status: "leads" },
        { id: "campaign", prospect_status: null, prospect_source: "linkedin_campaign" },
        { id: "scorecard", prospect_status: "leads", prospect_source: "lead_capture" },
        { id: "legacy", prospect_status: "leads", prospect_source: null },
        { id: "progressed", prospect_status: "replied", prospect_source: "linkedin_campaign" },
      ],
      poolIds
    );
    assert.deepEqual(
      rows.map((row) => row.id),
      ["manual", "scorecard", "legacy", "progressed"]
    );
  });
});
