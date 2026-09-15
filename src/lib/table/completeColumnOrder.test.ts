import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { completeColumnOrder } from "./completeColumnOrder";

describe("completeColumnOrder", () => {
  it("inserts a new first column at the start", () => {
    assert.deepEqual(
      completeColumnOrder(["status", "linkedin"], [
        "contact_info",
        "status",
        "linkedin",
        "source",
      ]),
      ["contact_info", "status", "linkedin", "source"]
    );
  });

  it("inserts a missing middle column after its default predecessor", () => {
    assert.deepEqual(
      completeColumnOrder(["contact_info", "source"], [
        "contact_info",
        "status",
        "source",
      ]),
      ["contact_info", "status", "source"]
    );
  });

  it("keeps an explicit custom order", () => {
    assert.deepEqual(
      completeColumnOrder(["source", "contact_info", "status"], [
        "contact_info",
        "status",
        "source",
      ]),
      ["source", "contact_info", "status"]
    );
  });
});
