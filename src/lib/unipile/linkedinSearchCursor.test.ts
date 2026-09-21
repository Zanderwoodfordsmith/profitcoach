import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decodeUnipileSearchCursor,
  encodeUnipileUrlSearchCursor,
  nextUnipileUrlSearchCursor,
  salesNavUrlForUnipile,
} from "@/lib/unipile/linkedinSearchCursor";

describe("Unipile URL search cursor", () => {
  it("round-trips account, start, limit, and url", () => {
    const encoded = encodeUnipileUrlSearchCursor({
      account_id: "acc_1",
      limit: 100,
      start: 10,
      url: "https://www.linkedin.com/sales/search/people?query=(filters:List())",
    });
    const decoded = decodeUnipileSearchCursor(encoded);
    assert.equal(decoded?.account_id, "acc_1");
    assert.equal(decoded?.limit, 100);
    assert.equal(decoded?.start, 10);
  });

  it("rewrites a probe limit=1 cursor to page size 100 at the next start", () => {
    const probe = encodeUnipileUrlSearchCursor({
      account_id: "acc_1",
      limit: 1,
      start: 1,
      url: "https://www.linkedin.com/sales/search/people?query=(x:1)",
    });
    const next = nextUnipileUrlSearchCursor({
      accountId: "acc_1",
      url: "https://www.linkedin.com/sales/search/people?query=(x:1)",
      start: 10,
      limit: 100,
      providerCursor: probe,
    });
    const decoded = decodeUnipileSearchCursor(next);
    assert.equal(decoded?.limit, 100);
    assert.equal(decoded?.start, 10);
  });

  it("builds a cursor when Unipile omitted one", () => {
    const next = nextUnipileUrlSearchCursor({
      accountId: "acc_1",
      url: "https://www.linkedin.com/sales/search/people?query=(x:1)&sessionId=abc",
      start: 10,
      limit: 100,
    });
    const decoded = decodeUnipileSearchCursor(next);
    assert.equal(decoded?.start, 10);
    assert.equal(decoded?.limit, 100);
    assert.equal(String(decoded?.url).includes("sessionId"), false);
  });

  it("keeps structured params when Unipile encoded them on the cursor", () => {
    const provider = Buffer.from(
      JSON.stringify({
        account_id: "acc_1",
        limit: 1,
        start: 10,
        params: { api: "sales_navigator", category: "people" },
      }),
      "utf8"
    ).toString("base64");
    const next = nextUnipileUrlSearchCursor({
      accountId: "acc_1",
      url: "https://www.linkedin.com/sales/search/people?query=(x:1)",
      start: 10,
      limit: 100,
      providerCursor: provider,
    });
    const decoded = decodeUnipileSearchCursor(next);
    assert.equal(decoded?.limit, 100);
    assert.deepEqual(decoded?.params, {
      api: "sales_navigator",
      category: "people",
    });
  });
});
