import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CAMPAIGN_LIBRARY_KIND_LABEL } from "./types";
import {
  blankLibraryMessageStep,
  cleanLibraryStep,
  normalizeLibraryName,
  normalizeLibrarySteps,
  parseLibraryItemType,
  parseLibraryKind,
  sanitizeLibraryItemSettings,
} from "./sanitize";

describe("campaign library kinds and types", () => {
  it("accepts the four campaign kinds and three item types", () => {
    assert.equal(parseLibraryKind("connector"), "connector");
    assert.equal(parseLibraryKind("reactivation"), "reactivation");
    assert.equal(parseLibraryKind("nurture"), "nurture");
    assert.equal(parseLibraryKind("positive_reply"), "positive_reply");
    assert.equal(parseLibraryKind("lead_magnet"), null);
    assert.equal(CAMPAIGN_LIBRARY_KIND_LABEL.connector, "Connection");
    assert.equal(CAMPAIGN_LIBRARY_KIND_LABEL.reactivation, "Reactivation");
    assert.equal(CAMPAIGN_LIBRARY_KIND_LABEL.nurture, "Ongoing nurture");
    assert.equal(CAMPAIGN_LIBRARY_KIND_LABEL.positive_reply, "Positive replies");
    assert.equal(parseLibraryItemType("template"), "template");
    assert.equal(parseLibraryItemType("sequence"), "sequence");
    assert.equal(parseLibraryItemType("step"), "step");
    assert.equal(parseLibraryItemType("campaign"), null);
  });

  it("falls back to an untitled name", () => {
    assert.equal(normalizeLibraryName("template", "  VIP connector  "), "VIP connector");
    assert.equal(normalizeLibraryName("sequence", "   "), "Untitled sequence");
    assert.equal(normalizeLibraryName("step", null), "Untitled step");
  });
});

describe("campaign library settings", () => {
  it("keeps template send defaults and empties settings for sequences and steps", () => {
    const template = sanitizeLibraryItemSettings("template", {
      stop_on_reply: false,
      daily_invite_limit: 9,
      timezone: "America/New_York",
    });
    assert.equal("stop_on_reply" in template && template.stop_on_reply, false);
    assert.equal("daily_invite_limit" in template && template.daily_invite_limit, 9);
    assert.equal("timezone" in template && template.timezone, "America/New_York");
    assert.equal("manual_fallback_hours" in template && template.manual_fallback_hours, null);
    assert.ok("send_rules" in template && Array.isArray(template.send_rules));
    assert.deepEqual(sanitizeLibraryItemSettings("sequence", { daily_invite_limit: 50 }), {});
    assert.deepEqual(
      sanitizeLibraryItemSettings("sequence", { manual_fallback_hours: 24 }),
      { manual_fallback_hours: 24 }
    );
    assert.deepEqual(sanitizeLibraryItemSettings("step", { stop_on_reply: false }), {});
  });
});

describe("campaign library step replace", () => {
  it("strips live campaign ids from add-to-campaign and invite branches", () => {
    const added = cleanLibraryStep(
      {
        position: 0,
        step_type: "add_to_campaign",
        config: { campaign_id: "11111111-1111-4111-8111-111111111111" },
      },
      0
    );
    assert.equal(added?.config?.campaign_id, null);

    const invite = cleanLibraryStep(
      {
        position: 0,
        step_type: "invite",
        body: "Hi {{first_name}}",
        config: {
          on_no_connect: "other_campaign",
          no_connect_campaign_id: "22222222-2222-4222-8222-222222222222",
          no_connect_wait_hours: 48,
        },
      },
      0
    );
    assert.equal(invite?.config?.on_no_connect, "none");
    assert.equal(invite?.config?.no_connect_campaign_id, null);
    assert.equal(invite?.body, "Hi {{first_name}}");
  });

  it("always persists exactly one step for step items", () => {
    const empty = normalizeLibrarySteps("step", []);
    assert.equal(empty.length, 1);
    assert.equal(empty[0]?.step_type, "message");
    assert.equal(empty[0]?.position, 0);

    const many = normalizeLibrarySteps("step", [
      { position: 0, step_type: "email", body: "Subject: Hello\n\nHi" },
      { position: 1, step_type: "wait", wait_hours: 24 },
    ]);
    assert.equal(many.length, 1);
    assert.equal(many[0]?.step_type, "email");
    assert.equal(many[0]?.position, 0);
  });

  it("keeps ordered sequences and drops unknown types", () => {
    const steps = normalizeLibrarySteps("sequence", [
      { position: 9, step_type: "message", body: "First" },
      { position: 1, step_type: "not-a-type" as never, body: "Nope" },
      { position: 2, step_type: "wait", wait_hours: 48 },
    ]);
    assert.equal(steps.length, 2);
    assert.equal(steps[0]?.step_type, "message");
    assert.equal(steps[0]?.position, 0);
    assert.equal(steps[1]?.step_type, "wait");
    assert.equal(steps[1]?.position, 1);
  });

  it("allows an empty template or sequence", () => {
    assert.deepEqual(normalizeLibrarySteps("template", []), []);
    assert.deepEqual(normalizeLibrarySteps("sequence", []), []);
    assert.equal(blankLibraryMessageStep().step_type, "message");
  });

  it("drops C and extra variant keys", () => {
    const step = cleanLibraryStep(
      {
        position: 0,
        step_type: "message",
        body: "A copy",
        variants: [
          { key: "B", body: "B copy" },
          { key: "C", body: "C copy" },
          { key: "A", body: "A copy" },
        ],
      },
      0
    );
    assert.deepEqual(
      step?.variants?.map((variant) => variant.key),
      ["A", "B"]
    );
  });

  it("keeps a manual message with fallback turned off", () => {
    const step = cleanLibraryStep(
      {
        position: 0,
        step_type: "message",
        body: "Hi",
        send_mode: "remind",
        fallback_hours: null,
      },
      0
    );
    assert.equal(step?.send_mode, "remind");
    assert.equal(step?.fallback_hours, null);
  });
});
