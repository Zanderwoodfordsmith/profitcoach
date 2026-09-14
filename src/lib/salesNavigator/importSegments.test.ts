import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SALES_NAV_BASE_SEARCH_1ST_URL,
  SALES_NAV_BASE_SEARCH_URL,
} from "@/lib/salesNavigator/salesNavLinks";
import { planSalesNavImportSegments } from "@/lib/salesNavigator/importSegments";

describe("planSalesNavImportSegments", () => {
  it("splits 1st-degree classroom search by team size", () => {
    const plan = planSalesNavImportSegments({
      salesNavUrl: SALES_NAV_BASE_SEARCH_1ST_URL,
      targetLeadCount: 2500,
    });
    assert.deepEqual(
      plan.map((s) => s.teamSize),
      ["1-10", "11-50", "51-200"]
    );
  });

  it("splits the classroom 2nd+3rd base search by team size", () => {
    const plan = planSalesNavImportSegments({
      salesNavUrl: SALES_NAV_BASE_SEARCH_URL,
      targetLeadCount: 2500,
    });
    assert.deepEqual(
      plan.map((s) => s.teamSize),
      ["1-10", "11-50", "51-200"]
    );
  });
});
