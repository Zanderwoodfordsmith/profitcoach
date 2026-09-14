import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rewriteSalesNavUrlHeadcounts } from "@/lib/salesNavigator/salesNavUrlRewrite";

/** Minimal encoded Sales Nav people URL with CURRENT_COMPANY before COMPANY_HEADCOUNT. */
const SAMPLE_URL =
  "https://www.linkedin.com/sales/search/people?query=(filters%3AList((type%3ACURRENT_COMPANY%2Cvalues%3AList((text%3Acoach%2CselectionType%3AEXCLUDED)))%2C(type%3ACOMPANY_HEADCOUNT%2Cvalues%3AList((id%3AE%2Ctext%3A201-500%2CselectionType%3AINCLUDED)))%2C(type%3AREGION%2Cvalues%3AList((id%3A101165590%2Ctext%3AUnited%2520Kingdom%2CselectionType%3AINCLUDED)))))&sessionId=abc&viewAllFilters=true";

function filterTypeOrder(salesNavUrl: string): string[] {
  const raw = salesNavUrl.match(/[?&]query=([^&]*)/)?.[1] ?? "";
  let q = raw;
  for (let i = 0; i < 3; i++) {
    try {
      const next = decodeURIComponent(q);
      if (next === q) break;
      q = next;
    } catch {
      break;
    }
  }
  return [...q.matchAll(/type:([A-Z_]+),/g)].map((m) => m[1]);
}

describe("rewriteSalesNavUrlHeadcounts", () => {
  it("keeps filter order when replacing an existing headcount band", () => {
    const next = rewriteSalesNavUrlHeadcounts(SAMPLE_URL, ["11-50"]);
    assert.deepEqual(filterTypeOrder(next), filterTypeOrder(SAMPLE_URL));
    assert.match(next, /type%3ACOMPANY_HEADCOUNT%2Cvalues%3AList\(\(id%3AC%2Ctext%3A11-50/);
    assert.doesNotMatch(next, /^[^?]*\?query=\(filters%3AList\(\(type%3ACOMPANY_HEADCOUNT/);
  });

  it("does not move COMPANY_HEADCOUNT to the front of the filters list", () => {
    const next = rewriteSalesNavUrlHeadcounts(SAMPLE_URL, ["201-500"]);
    assert.equal(filterTypeOrder(next)[0], "CURRENT_COMPANY");
    assert.ok(filterTypeOrder(next).indexOf("COMPANY_HEADCOUNT") > 0);
  });
});
