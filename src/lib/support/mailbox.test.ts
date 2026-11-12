import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapAccountStatus } from "./mailbox";

describe("mapAccountStatus", () => {
  it("goes by the mail connection when the calendar one is still fine", () => {
    assert.equal(
      mapAccountStatus({
        sources: [
          { id: "acc_CALENDAR", status: "OK" },
          { id: "acc_MAILS", status: "CREDENTIALS" },
        ],
      }),
      "CREDENTIALS"
    );
  });

  it("reads OK when the mail connection is fine", () => {
    assert.equal(
      mapAccountStatus({
        sources: [
          { id: "acc_MAILS", status: "OK" },
          { id: "acc_CALENDAR", status: "OK" },
        ],
      }),
      "OK"
    );
  });
});
