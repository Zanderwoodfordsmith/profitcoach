import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { unipileLinkedInSearchRequest } from "@/lib/unipile/client";

describe("unipileLinkedInSearchRequest", () => {
  it("sends the Sales Nav URL only on the first page", () => {
    const { path, body } = unipileLinkedInSearchRequest({
      account_id: "acc_1",
      url: "https://www.linkedin.com/sales/search/people?query=(filters:List())",
      limit: 100,
    });
    assert.equal(path.includes("account_id=acc_1"), true);
    assert.equal(path.includes("limit=100"), true);
    assert.equal(path.includes("cursor="), false);
    assert.equal(
      body.url,
      "https://www.linkedin.com/sales/search/people?query=(filters:List())"
    );
    assert.equal(body.cursor, undefined);
  });

  it("keeps a long URL-search cursor in the body only", () => {
    const cursor = "c".repeat(1600);
    const { path, body } = unipileLinkedInSearchRequest({
      account_id: "acc_1",
      cursor,
      limit: 100,
    });
    assert.equal(body.cursor, cursor);
    assert.equal(path.includes("cursor="), false);
  });
});
