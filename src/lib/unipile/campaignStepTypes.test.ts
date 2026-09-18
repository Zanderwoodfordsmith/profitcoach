import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  campaignStepDisplayLabel,
  campaignStepIncompleteHint,
  inviteNoConnectFrom,
  messageMediaFrom,
  messageMediaKindFrom,
  sanitizeStepConfig,
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
