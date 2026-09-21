import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { POSITIVE_REPLY_LIBRARY_SEED, positiveReplyLibrarySteps } from "./positiveReply";

describe("positive reply library template", () => {
  it("is a published positive-reply template with only manual LinkedIn sends", () => {
    assert.equal(POSITIVE_REPLY_LIBRARY_SEED.kind, "positive_reply");
    assert.equal(POSITIVE_REPLY_LIBRARY_SEED.name, "Positive replies");
    assert.equal(POSITIVE_REPLY_LIBRARY_SEED.itemType, "template");
    assert.equal(POSITIVE_REPLY_LIBRARY_SEED.status, "published");
    const steps = positiveReplyLibrarySteps();
    const messages = steps.filter((step) => step.step_type === "message");
    assert.ok(messages.length >= 5);
    for (const step of messages) {
      assert.equal(step.send_mode, "remind");
      assert.equal(step.fallback_hours, null);
    }
    assert.ok(steps.some((step) => step.step_type === "call"));
    assert.ok(
      messages.some((step) =>
        String(step.body).includes("answerphone ping pong")
      )
    );
    const day0 = messages[0];
    assert.equal(day0?.variants?.length, 2);
    assert.ok(day0?.variants?.some((v) => v.body.includes("called a couple of times")));
    assert.ok(day0?.variants?.some((v) => v.body.includes("just something specific")));
  });

  it("does not auto-send any LinkedIn message", () => {
    const autos = positiveReplyLibrarySteps().filter(
      (step) => step.step_type === "message" && step.send_mode !== "remind"
    );
    assert.equal(autos.length, 0);
  });
});
