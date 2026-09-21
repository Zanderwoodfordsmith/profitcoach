import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  REACTIVATION_LIBRARY_SEED,
  reactivationLibrarySteps,
} from "./reactivation";

describe("reactivation library template", () => {
  it("is a published reactivation template with no invite", () => {
    assert.equal(REACTIVATION_LIBRARY_SEED.kind, "reactivation");
    assert.equal(REACTIVATION_LIBRARY_SEED.name, "Reactivation");
    assert.equal(REACTIVATION_LIBRARY_SEED.itemType, "template");
    assert.equal(REACTIVATION_LIBRARY_SEED.status, "published");
    assert.equal(REACTIVATION_LIBRARY_SEED.settings?.stop_on_reply, true);

    const steps = reactivationLibrarySteps();
    assert.equal(
      steps.some((step) => step.step_type === "invite"),
      false
    );
    assert.deepEqual(
      steps
        .filter((step) => step.step_type === "wait")
        .map((step) => step.wait_hours),
      [72, 96, 96]
    );

    const messages = steps.filter((step) => step.step_type === "message");
    assert.equal(messages.length, 4);
    assert.ok(String(messages[0]?.body).includes("we connected a while back"));
    assert.ok(String(messages[3]?.body).includes("{{scorecard_link}}"));
  });

  it("uses the check-in as the control and the scorecard invite as the test", () => {
    const first = reactivationLibrarySteps().filter(
      (step) => step.step_type === "message"
    )[0];
    const variants = first?.variants ?? [];
    assert.equal(variants[0]?.key, "B");
    assert.equal(first?.body, variants[0]?.body);
    assert.equal(variants[1]?.key, "A");
    assert.ok(String(variants[1]?.body).includes("BOSS Scorecard"));
  });
});
