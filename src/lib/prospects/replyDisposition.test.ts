import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  dispositionFromInterestOutcome,
  inferReplyDisposition,
  interestOutcomeForDisposition,
  isReplyDisposition,
  prospectStatusForDisposition,
} from "./replyDisposition";

describe("replyDisposition", () => {
  it("maps labels to campaign interest outcomes", () => {
    assert.equal(interestOutcomeForDisposition("interested"), "positive");
    assert.equal(interestOutcomeForDisposition("neutral"), "soft");
    assert.equal(interestOutcomeForDisposition("not_interested"), "negative");
  });

  it("maps outcomes back to labels", () => {
    assert.equal(dispositionFromInterestOutcome("positive"), "interested");
    assert.equal(dispositionFromInterestOutcome("soft"), "neutral");
    assert.equal(dispositionFromInterestOutcome("negative"), "not_interested");
    assert.equal(dispositionFromInterestOutcome("unclear"), null);
  });

  it("moves open-funnel people and leaves booked/won alone", () => {
    assert.equal(prospectStatusForDisposition("interested", "replied"), "interested");
    assert.equal(prospectStatusForDisposition("neutral", "leads"), "follow_up");
    assert.equal(
      prospectStatusForDisposition("not_interested", "replied"),
      "lost"
    );
    assert.equal(prospectStatusForDisposition("interested", "booked"), null);
    assert.equal(prospectStatusForDisposition("not_interested", "won"), null);
  });

  it("prefers an explicit stored disposition", () => {
    assert.equal(
      inferReplyDisposition({
        replyDisposition: "neutral",
        prospectStatus: "interested",
        interestOutcome: "positive",
      }),
      "neutral"
    );
    assert.equal(isReplyDisposition("maybe"), false);
  });
});
