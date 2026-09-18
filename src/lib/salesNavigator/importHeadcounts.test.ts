import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SALES_NAV_BASE_SEARCH_1ST_URL } from "@/lib/salesNavigator/salesNavLinks";
import {
  extraImportTeamSizeOptions,
  formatImportTeamSizeList,
  implicitImportTeamSizes,
  salesNavUrlWithImportTeamSizes,
} from "./importHeadcounts";
import { teamSizesFromSalesNavUrl } from "./parseSalesNavFilters";

describe("implicitImportTeamSizes", () => {
  it("reads classroom 1st-degree bands from the URL", () => {
    assert.deepEqual(implicitImportTeamSizes(SALES_NAV_BASE_SEARCH_1ST_URL), [
      "1-10",
      "11-50",
      "51-200",
    ]);
  });

  it("falls back to classroom 1-200 when the URL has no company size", () => {
    const url =
      "https://www.linkedin.com/sales/search/people?query=(filters%3AList((type%3ARELATIONSHIP%2Cvalues%3AList((id%3AF%2Ctext%3A1st%2520Degree%2520Connections%2CselectionType%3AINCLUDED)))))";
    assert.deepEqual(implicitImportTeamSizes(url), ["1-10", "11-50", "51-200"]);
  });
});

describe("extraImportTeamSizeOptions", () => {
  it("offers larger bands and self-employed for the classroom search", () => {
    assert.deepEqual(
      extraImportTeamSizeOptions(SALES_NAV_BASE_SEARCH_1ST_URL).map((b) => b.label),
      ["Self-employed", "201-500", "501-1000", "1001-5000", "5001-10000", "10001+"]
    );
  });
});

describe("formatImportTeamSizeList", () => {
  it("joins with and", () => {
    assert.equal(
      formatImportTeamSizeList(["51-200", "1-10", "11-50"]),
      "1-10, 11-50 and 51-200"
    );
  });
});

describe("salesNavUrlWithImportTeamSizes", () => {
  it("adds a larger band onto the classroom URL", () => {
    const next = salesNavUrlWithImportTeamSizes(SALES_NAV_BASE_SEARCH_1ST_URL, [
      "201-500",
    ]);
    assert.deepEqual(teamSizesFromSalesNavUrl(next), [
      "1-10",
      "11-50",
      "51-200",
      "201-500",
    ]);
  });
});
