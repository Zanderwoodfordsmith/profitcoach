import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifySalesNavUrl, prepareSalesNavImportUrl } from "@/lib/salesNavigator/classifySalesNavUrl";
import {
  planSalesNavImportSegments,
  subSplitOverExtractCap,
} from "@/lib/salesNavigator/importSegments";
import { SALES_NAV_BASE_SEARCH_URL } from "@/lib/salesNavigator/salesNavLinks";

const SAVED =
  "https://www.linkedin.com/sales/search/people?savedSearchId=1960736146&sessionId=abc";
const RECENT =
  "https://www.linkedin.com/sales/search/people?recentSearchId=4559699729";

describe("classifySalesNavUrl", () => {
  it("treats a filter query as a splittable search", () => {
    assert.equal(classifySalesNavUrl(SALES_NAV_BASE_SEARCH_URL).kind, "query");
  });

  it("treats a saved people search as its own kind", () => {
    const classified = classifySalesNavUrl(SAVED);
    assert.equal(classified.kind, "saved_people");
    if (classified.kind === "saved_people") {
      assert.equal(classified.id, "1960736146");
    }
  });

  it("treats a recent people search as its own kind", () => {
    const classified = classifySalesNavUrl(RECENT);
    assert.equal(classified.kind, "recent_people");
  });

  it("rejects a company search and asks for a support ticket", () => {
    const classified = classifySalesNavUrl(
      "https://www.linkedin.com/sales/search/company?savedSearchId=1743805731"
    );
    assert.equal(classified.kind, "rejected");
    if (classified.kind === "rejected") {
      assert.equal(classified.reason, "company");
      assert.equal(classified.support, true);
      assert.match(classified.message, /support ticket/i);
    }
  });

  it("rejects a lead list", () => {
    const classified = classifySalesNavUrl(
      "https://www.linkedin.com/sales/lists/people/12345"
    );
    assert.equal(classified.kind, "rejected");
    if (classified.kind === "rejected") assert.equal(classified.reason, "lead_list");
  });

  it("rejects a people URL that has no filters", () => {
    const classified = classifySalesNavUrl(
      "https://www.linkedin.com/sales/search/people?sessionId=abc"
    );
    assert.equal(classified.kind, "rejected");
    if (classified.kind === "rejected") assert.equal(classified.reason, "no_filters");
  });

  it("drops a session id and someone else's saved search when the filters are in the link", () => {
    const prepared = prepareSalesNavImportUrl(
      "https://www.linkedin.com/sales/search/people?query=(filters%3AList((type%3ACOMPANY_HEADCOUNT%2Cvalues%3AList((id%3AC%2Ctext%3A11-50%2CselectionType%3AINCLUDED)))))&savedSearchId=2003683970&sessionId=abc"
    );
    assert.equal(prepared.classified.kind, "query");
    assert.equal(prepared.url.includes("savedSearchId="), false);
    assert.equal(prepared.url.includes("sessionId="), false);
    assert.equal(prepared.url.includes("filters%3AList("), true);
    assert.equal(prepared.adjustments.length, 2);
  });

  it("keeps a saved-search id when the link has no filters", () => {
    const prepared = prepareSalesNavImportUrl(SAVED);
    assert.equal(prepared.classified.kind, "saved_people");
    assert.match(prepared.url, /savedSearchId=1960736146/);
    assert.equal(prepared.url.includes("sessionId="), false);
  });
});

describe("planSalesNavImportSegments saved searches", () => {
  it("imports a saved search as one segment and does not rewrite it", () => {
    const plan = planSalesNavImportSegments({
      salesNavUrl: SAVED,
      targetLeadCount: 2500,
    });
    assert.equal(plan.length, 1);
    assert.equal(plan[0]?.label, "Saved search");
    assert.match(plan[0]?.salesNavUrl ?? "", /savedSearchId=1960736146/);
    assert.equal(subSplitOverExtractCap(plan[0]!), null);
  });

  it("still splits a classroom query by team size", () => {
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
