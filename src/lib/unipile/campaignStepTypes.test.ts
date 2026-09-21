import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  campaignFallbackEnabled,
  campaignFallbackHoursPatch,
  campaignNewStepSendFields,
  campaignSendModePatch,
  parseManualFallbackHours,
  campaignStepDisplayLabel,
  campaignStepHasSendMode,
  campaignStepIncompleteHint,
  campaignStepSendMode,
  inviteNoConnectFrom,
  keepAbPair,
  messageMediaFrom,
  messageMediaKindFrom,
  sanitizeStepConfig,
  sequenceMessageSendMode,
} from "./campaignStepTypes";

describe("sanitizeStepConfig message media", () => {
  it("keeps a voice upload and strips signed urls", () => {
    const config = sanitizeStepConfig("message", {
      media_kind: "voice",
      media: {
        kind: "voice",
        path: "coach/campaigns/camp/file.webm",
        mime: "audio/webm",
        filename: "note.webm",
        size: 1200,
        signed_url: "https://example.com/secret",
      },
    });
    assert.deepEqual(config, {
      media_kind: "voice",
      media: {
        kind: "voice",
        path: "coach/campaigns/camp/file.webm",
        mime: "audio/webm",
        filename: "note.webm",
        size: 1200,
      },
    });
    assert.equal(messageMediaFrom(config)?.kind, "voice");
  });

  it("keeps media_kind before a file is uploaded", () => {
    const config = sanitizeStepConfig("message", { media_kind: "video" });
    assert.deepEqual(config, { media_kind: "video", media: null });
    assert.equal(messageMediaKindFrom(config), "video");
  });

  it("rejects path traversal", () => {
    const config = sanitizeStepConfig("message", {
      media: { kind: "voice", path: "../secret.webm", mime: "audio/webm" },
    });
    assert.equal(config.media, null);
  });
});

describe("campaign message step labels", () => {
  it("names voice and video steps distinctly", () => {
    assert.equal(campaignStepDisplayLabel("message"), "LinkedIn message");
    assert.equal(
      campaignStepDisplayLabel("message", { media_kind: "voice" }),
      "Voice note"
    );
    assert.equal(
      campaignStepDisplayLabel("message", { media_kind: "video" }),
      "Video message"
    );
  });

  it("flags empty copy and missing media", () => {
    assert.equal(
      campaignStepIncompleteHint({
        step_type: "message",
        body: "",
      }),
      "You need to add a message"
    );
    assert.equal(
      campaignStepIncompleteHint({
        step_type: "message",
        body: "Hi",
        config: { media_kind: "video" },
      }),
      "You need to add a video"
    );
    assert.equal(
      campaignStepIncompleteHint({
        step_type: "message",
        body: "",
        config: { media_kind: "voice" },
      }),
      "You need to add a voice note"
    );
    assert.equal(
      campaignStepIncompleteHint({
        step_type: "message",
        body: "Hi",
      }),
      null
    );
    assert.equal(
      campaignStepIncompleteHint({
        step_type: "message",
        body: "Hi",
        variants: [
          { body: "Hi", media_kind: null },
          { body: "", media_kind: "voice", media: null },
        ],
      }),
      "You need to add a voice note"
    );
    assert.equal(
      campaignStepDisplayLabel("message", {}, [
        { media_kind: null },
        { media_kind: "voice" },
      ]),
      "A/B message"
    );
  });
});

describe("keepAbPair", () => {
  it("keeps A then B and drops extra keys", () => {
    assert.deepEqual(
      keepAbPair([
        { key: "B", body: "b" },
        { key: "C", body: "c" },
        { key: "A", body: "a" },
      ]),
      [
        { key: "A", body: "a" },
        { key: "B", body: "b" },
      ]
    );
  });
});

describe("invite no-connect", () => {
  it("defaults to do nothing", () => {
    assert.deepEqual(inviteNoConnectFrom({}), {
      on_no_connect: "none",
      no_connect_wait_hours: null,
      no_connect_campaign_id: null,
    });
  });

  it("keeps a campaign branch and wait", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const config = sanitizeStepConfig("invite", {
      on_no_connect: "other_campaign",
      no_connect_wait_hours: 48,
      no_connect_campaign_id: id,
    });
    assert.deepEqual(inviteNoConnectFrom(config), {
      on_no_connect: "other_campaign",
      no_connect_wait_hours: 48,
      no_connect_campaign_id: id,
    });
  });
});

describe("campaign send mode", () => {
  it("only LinkedIn messages can be auto or manual", () => {
    assert.equal(campaignStepHasSendMode("message"), true);
    assert.equal(campaignStepHasSendMode("email"), false);
    assert.equal(campaignStepHasSendMode("invite"), false);
    assert.equal(campaignStepHasSendMode("wait"), false);
  });

  it("treats missing send_mode as auto", () => {
    assert.equal(campaignStepSendMode(null), "auto");
    assert.equal(campaignStepSendMode("remind"), "remind");
  });

  it("clears fallback when switching to auto and copies the campaign default onto new manual steps", () => {
    assert.deepEqual(campaignSendModePatch("auto", { fallbackHours: 48 }), {
      send_mode: "auto",
      fallback_hours: null,
      fallback_body: null,
    });
    assert.deepEqual(campaignSendModePatch("remind"), {
      send_mode: "remind",
      fallback_hours: null,
    });
    assert.deepEqual(
      campaignSendModePatch("remind", { defaultFallbackHours: 24 }),
      { send_mode: "remind", fallback_hours: 24 }
    );
    assert.deepEqual(
      campaignSendModePatch("remind", {
        fromMode: "remind",
        fallbackHours: 72,
      }),
      { send_mode: "remind", fallback_hours: 72 }
    );
    assert.deepEqual(
      campaignSendModePatch("remind", {
        fromMode: "remind",
        fallbackHours: null,
        defaultFallbackHours: 24,
      }),
      { send_mode: "remind", fallback_hours: null }
    );
  });

  it("lets a manual step turn fallback off and back on", () => {
    assert.equal(campaignFallbackEnabled(24), true);
    assert.equal(campaignFallbackEnabled(null), false);
    assert.equal(campaignFallbackHoursPatch(false, 72), null);
    assert.equal(campaignFallbackHoursPatch(true, null), 24);
    assert.equal(campaignFallbackHoursPatch(true, 72), 72);
  });

  it("parses the campaign fallback default and copies it onto new manual messages only", () => {
    assert.equal(parseManualFallbackHours(null), null);
    assert.equal(parseManualFallbackHours(true), 24);
    assert.equal(parseManualFallbackHours(24), 24);
    assert.deepEqual(campaignNewStepSendFields("message", "auto", 24), {
      send_mode: "auto",
      fallback_hours: null,
      fallback_body: null,
    });
    assert.deepEqual(campaignNewStepSendFields("message", "remind", null), {
      send_mode: "remind",
      fallback_hours: null,
      fallback_body: null,
    });
    assert.deepEqual(campaignNewStepSendFields("message", "remind", 24), {
      send_mode: "remind",
      fallback_hours: 24,
      fallback_body: null,
    });
    assert.deepEqual(campaignNewStepSendFields("wait", "remind", 24), {
      send_mode: "auto",
      fallback_hours: null,
      fallback_body: null,
    });
  });

  it("summarises message steps as auto, manual, mixed, or none", () => {
    assert.equal(sequenceMessageSendMode([{ step_type: "wait" }]), null);
    assert.equal(
      sequenceMessageSendMode([
        { step_type: "message", send_mode: "auto" },
        { step_type: "message", send_mode: "auto" },
      ]),
      "auto"
    );
    assert.equal(
      sequenceMessageSendMode([
        { step_type: "message", send_mode: "remind" },
        { step_type: "wait" },
      ]),
      "remind"
    );
    assert.equal(
      sequenceMessageSendMode([
        { step_type: "message", send_mode: "auto" },
        { step_type: "message", send_mode: "remind" },
      ]),
      "mixed"
    );
  });
});
