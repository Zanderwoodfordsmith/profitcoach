import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { prospectCreatedActivityTitle } from "./prospectCreatedActivityTitle";

describe("prospectCreatedActivityTitle", () => {
  it("keeps client conversion copy", () => {
    assert.equal(
      prospectCreatedActivityTitle({ isClient: true, prospectSource: "google_maps" }),
      "Became a client"
    );
  });

  it("labels pool imports as imported into pool, not became a lead", () => {
    assert.equal(
      prospectCreatedActivityTitle({
        isClient: false,
        prospectSource: "google_maps",
      }),
      "Imported into pool"
    );
    assert.equal(
      prospectCreatedActivityTitle({
        isClient: false,
        prospectSource: "sales_nav",
      }),
      "Imported into pool"
    );
  });

  it("does not say became a lead for other prospects", () => {
    assert.equal(
      prospectCreatedActivityTitle({
        isClient: false,
        prospectSource: "lead_capture",
      }),
      "Added as a prospect"
    );
    assert.equal(
      prospectCreatedActivityTitle({ isClient: false, prospectSource: null }),
      "Added as a prospect"
    );
  });
});
