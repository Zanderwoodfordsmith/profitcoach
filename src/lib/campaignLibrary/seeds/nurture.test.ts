import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NURTURE_LIBRARY_SEED, nurtureLibrarySteps } from "./nurture";

describe("ongoing nurture library template", () => {
  it("is a published nurture template with tools every two weeks", () => {
    assert.equal(NURTURE_LIBRARY_SEED.kind, "nurture");
    assert.equal(NURTURE_LIBRARY_SEED.name, "Ongoing nurture");
    assert.equal(NURTURE_LIBRARY_SEED.itemType, "template");
    assert.equal(NURTURE_LIBRARY_SEED.status, "published");
    assert.equal(NURTURE_LIBRARY_SEED.settings?.stop_on_reply, true);

    const steps = nurtureLibrarySteps();
    assert.equal(
      steps.some((step) => step.step_type === "invite"),
      false
    );
    assert.deepEqual(
      steps
        .filter((step) => step.step_type === "wait")
        .map((step) => step.wait_hours),
      [336, 336, 72, 336, 72, 336]
    );

    const messages = steps.filter((step) => step.step_type === "message");
    assert.equal(messages.length, 7);
    assert.ok(String(messages[0]?.body).includes("Pairwise Prioritising"));
    assert.ok(String(messages[6]?.body).includes("Time Value Tracker"));
  });
});
