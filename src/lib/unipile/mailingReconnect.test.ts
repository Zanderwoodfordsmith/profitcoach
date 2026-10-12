import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pickMailingReconnectAccountId } from "./mailingReconnect";

const adam = {
  provider: "GOOGLE",
  status: "OK",
  unipile_account_id: "adam-google",
};

describe("pickMailingReconnectAccountId", () => {
  it("upgrades the connected mailbox when calendar access is missing", () => {
    assert.equal(
      pickMailingReconnectAccountId([adam], "GOOGLE", {
        upgradeConnected: true,
      }),
      "adam-google"
    );
  });

  it("does not start a second Google account while the first is still OK", () => {
    assert.equal(pickMailingReconnectAccountId([adam], "GOOGLE"), null);
  });

  it("reconnects a mailbox that is no longer OK", () => {
    assert.equal(
      pickMailingReconnectAccountId(
        [{ ...adam, status: "CREDENTIALS" }],
        "GOOGLE"
      ),
      "adam-google"
    );
  });

  it("ignores a different provider", () => {
    assert.equal(
      pickMailingReconnectAccountId([adam], "OUTLOOK", {
        upgradeConnected: true,
      }),
      null
    );
  });
});
