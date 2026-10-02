import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { composeChannelForStep } from "./composePreview";

describe("composeChannelForStep", () => {
  it("maps send steps onto inbox channels", () => {
    assert.equal(composeChannelForStep("email"), "email");
    assert.equal(composeChannelForStep("whatsapp"), "whatsapp");
    assert.equal(composeChannelForStep("message"), "linkedin");
    assert.equal(composeChannelForStep("invite"), "linkedin");
    assert.equal(composeChannelForStep("message", "email"), "email");
    assert.equal(composeChannelForStep("instagram"), "instagram");
    assert.equal(composeChannelForStep("messenger"), "messenger");
  });

  it("skips steps that are not a message to send", () => {
    assert.equal(composeChannelForStep("call"), null);
    assert.equal(composeChannelForStep("comment"), null);
    assert.equal(composeChannelForStep("wait"), null);
    assert.equal(composeChannelForStep("visit"), null);
  });
});
