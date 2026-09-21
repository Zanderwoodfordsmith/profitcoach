import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CONNECTOR_LIBRARY_SEED, connectorLibrarySteps } from "./connector";

describe("connector library template", () => {
  it("mirrors the live Connector playbook: invite then four messages", () => {
    assert.equal(CONNECTOR_LIBRARY_SEED.kind, "connector");
    assert.equal(CONNECTOR_LIBRARY_SEED.name, "Connector");
    assert.equal(CONNECTOR_LIBRARY_SEED.settings?.daily_invite_limit, 9);
    const steps = connectorLibrarySteps();
    assert.equal(steps[0]?.step_type, "invite");
    const messages = steps.filter((step) => step.step_type === "message");
    assert.equal(messages.length, 4);
    assert.equal(messages[2]?.body, "{{first_name}}?");
    assert.equal(messages[0]?.variants?.length, 3);
    assert.equal(messages[1]?.variants?.length, 3);
    assert.equal(messages[3]?.variants?.length, 3);
  });
});
