import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cleanCampaignStepsForSave } from "./campaignStepReplace";

describe("cleanCampaignStepsForSave", () => {
  it("keeps invite A/B variants and reindexes positions", () => {
    const cleaned = cleanCampaignStepsForSave([
      {
        id: "11111111-1111-4111-8111-111111111111",
        position: 4,
        step_type: "invite",
        body: "Hi {{first_name}}",
        variants: [
          { key: "A", label: "A", body: "Note A" },
          { key: "B", label: "B", body: "Note B" },
        ],
      },
      {
        position: 9,
        step_type: "wait",
        wait_hours: 24,
      },
    ]);
    assert.equal(cleaned.length, 2);
    assert.equal(cleaned[0]?.id, "11111111-1111-4111-8111-111111111111");
    assert.equal(cleaned[0]?.position, 0);
    assert.equal(cleaned[0]?.step_type, "invite");
    assert.deepEqual(
      cleaned[0]?.variants.map((v) => v.key),
      ["A", "B"]
    );
    assert.equal(cleaned[1]?.id, undefined);
    assert.equal(cleaned[1]?.position, 1);
  });

  it("drops duplicate ids so two rows never share a primary key", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const cleaned = cleanCampaignStepsForSave([
      { id, position: 0, step_type: "invite", body: "A" },
      { id, position: 1, step_type: "invite", body: "B" },
    ]);
    assert.equal(cleaned[0]?.id, id);
    assert.equal(cleaned[1]?.id, undefined);
  });

  it("keeps a manual message with fallback turned off", () => {
    const cleaned = cleanCampaignStepsForSave([
      {
        position: 0,
        step_type: "message",
        body: "Hi",
        send_mode: "remind",
        fallback_hours: null,
      },
    ]);
    assert.equal(cleaned[0]?.send_mode, "remind");
    assert.equal(cleaned[0]?.fallback_hours, null);
  });

  it("keeps BOSS level variants on the completed follow-up email", () => {
    const cleaned = cleanCampaignStepsForSave([
      {
        position: 0,
        step_type: "email",
        body: "Level 1",
        variants: [
          { key: "1", label: "Level 1 · Overwhelmed", body: "Level 1" },
          { key: "3", label: "Level 3 · Organised", body: "Level 3" },
          { key: "5", label: "Level 5 · Owner", body: "Level 5" },
        ],
      },
    ]);
    assert.deepEqual(
      cleaned[0]?.variants.map((variant) => variant.key),
      ["1", "3", "5"]
    );
  });

  it("drops unknown step types", () => {
    const cleaned = cleanCampaignStepsForSave([
      {
        position: 0,
        step_type: "not-a-step",
        body: "x",
      },
      { position: 1, step_type: "invite", body: "Hi" },
    ]);
    assert.equal(cleaned.length, 1);
    assert.equal(cleaned[0]?.position, 0);
    assert.equal(cleaned[0]?.body, "Hi");
  });
});
