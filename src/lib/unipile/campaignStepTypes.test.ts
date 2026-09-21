import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  campaignSendModePatch,
  campaignStepDisplayLabel,
  campaignStepHasSendMode,
  campaignStepIncompleteHint,
  campaignStepSendMode,
  inviteNoConnectFrom,
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

  it("clears fallback when switching to auto and defaults 24h for manual", () => {
    assert.deepEqual(campaignSendModePatch("auto", 48), {
      send_mode: "auto",
      fallback_hours: null,
      fallback_body: null,
    });
    assert.deepEqual(campaignSendModePatch("remind", null), {
      send_mode: "remind",
      fallback_hours: 24,
    });
    assert.deepEqual(campaignSendModePatch("remind", 72), {
      send_mode: "remind",
      fallback_hours: 72,
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
