import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateMessagingAttachment } from "./messageAttachments";
import { MAX_CAMPAIGN_STEP_MEDIA_BYTES } from "../unipile/campaignStepMediaLimits";

describe("validateMessagingAttachment size caps", () => {
  it("keeps inbox attachments at 15MB", () => {
    const err = validateMessagingAttachment({
      mime: "application/pdf",
      size: 16 * 1024 * 1024,
      filename: "deck.pdf",
    });
    assert.equal(err, "Each file must be under 15MB.");
  });

  it("allows campaign voice/video up to 50MB", () => {
    const ok = validateMessagingAttachment({
      mime: "video/mp4",
      size: 40 * 1024 * 1024,
      filename: "note.mp4",
      maxBytes: MAX_CAMPAIGN_STEP_MEDIA_BYTES,
    });
    assert.equal(ok, null);
    const err = validateMessagingAttachment({
      mime: "video/mp4",
      size: 51 * 1024 * 1024,
      filename: "note.mp4",
      maxBytes: MAX_CAMPAIGN_STEP_MEDIA_BYTES,
    });
    assert.equal(err, "Each file must be under 50MB.");
  });
});
