import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SALES_NAV_BASE_SEARCH_1ST_URL,
  SALES_NAV_BASE_SEARCH_URL,
} from "@/lib/salesNavigator/salesNavLinks";
import {
  planSalesNavImportSegments,
  shouldProbeSalesNavExtractCap,
  subSplitOverExtractCap,
  withCatchUpSegment,
} from "@/lib/salesNavigator/importSegments";

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

describe("withCatchUpSegment", () => {
  it("ends a tenure split with the unsplit search, which never splits again", () => {
    const [band] = planSalesNavImportSegments({
      salesNavUrl: SALES_NAV_BASE_SEARCH_URL,
      targetLeadCount: 2500,
    });
    const children = subSplitOverExtractCap(band);
    assert.ok(children && children.length > 1);
    const plan = withCatchUpSegment(band, children);
    const rest = plan[plan.length - 1];
    assert.equal(plan.length, children.length + 1);
    assert.equal(rest.id, `${band.id}|rest`);
    assert.equal(rest.salesNavUrl, band.salesNavUrl);
    assert.equal(rest.catchUp, true);
    assert.equal(shouldProbeSalesNavExtractCap(rest), false);
  });
});
