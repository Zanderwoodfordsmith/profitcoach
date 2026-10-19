import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CONNECTOR_LIBRARY_SEED, connectorLibrarySteps } from "./connector";

describe("connector library template", () => {
  it("stores the Connection sequence: blank invite, then four short messages", () => {
    assert.equal(CONNECTOR_LIBRARY_SEED.kind, "connector");
    assert.equal(CONNECTOR_LIBRARY_SEED.name, "Connection");
    assert.equal(CONNECTOR_LIBRARY_SEED.settings?.daily_invite_limit, 9);
    assert.equal(CONNECTOR_LIBRARY_SEED.settings?.stop_on_reply, true);

    const steps = connectorLibrarySteps();
    assert.equal(steps[0]?.step_type, "invite");
    assert.equal((steps[0]?.body ?? "").trim(), "");
    assert.deepEqual(
      steps.filter((step) => step.step_type === "wait").map((step) => step.wait_hours),
      [24, 72, 96, 96]
    );

    const messages = steps.filter((step) => step.step_type === "message");
    assert.equal(messages.length, 4);
    for (const message of messages) {
      assert.ok(String(message.body).length < 300, String(message.body).slice(0, 40));
      assert.equal(/just checking|free (coaching|discovery)|—/i.test(String(message.body)), false);
    }
  });

  it("uses observation as the control and growth vs keep as the test", () => {
    const first = connectorLibrarySteps().filter(
      (step) => step.step_type === "message"
    )[0];
    const variants = first?.variants ?? [];
    assert.equal(variants[0]?.key, "B");
    assert.equal(first?.body, variants[0]?.body);
    assert.ok(String(variants[0]?.body).includes("can't take a week off"));
    assert.equal(variants[1]?.key, "A");
    assert.ok(String(variants[1]?.body).includes("growing your business"));
  });
});
