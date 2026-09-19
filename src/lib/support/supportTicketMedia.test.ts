import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  supportComposerFallbackBody,
  supportEmailAttachmentFilename,
  supportReplyBodyForEmail,
} from "./supportTicketMedia";

describe("supportComposerFallbackBody", () => {
  it("keeps typed text", () => {
    assert.equal(
      supportComposerFallbackBody({ text: "Here you go", imageCount: 1 }),
      "Here you go"
    );
  });

  it("labels a voice-only reply", () => {
    assert.equal(
      supportComposerFallbackBody({ text: "", voice: true }),
      "Sent a voice note"
    );
  });

  it("labels an image-only reply", () => {
    assert.equal(
      supportComposerFallbackBody({ text: "", imageCount: 1 }),
      "Sent an image"
    );
  });
});

describe("supportReplyBodyForEmail", () => {
  it("adds a voice-note line when text is present", () => {
    assert.equal(
      supportReplyBodyForEmail("Try this", [{ url: "https://x/a.webm", kind: "audio" }]),
      "Try this\n\nVoice note attached."
    );
  });

  it("does not duplicate an existing voice-note sentence", () => {
    assert.equal(
      supportReplyBodyForEmail("Sent a voice note", [
        { url: "https://x/a.webm", kind: "audio" },
      ]),
      "Sent a voice note"
    );
  });

  it("mentions an attached image", () => {
    assert.equal(
      supportReplyBodyForEmail("Screenshot below", [
        { url: "https://x/a.png", kind: "image" },
      ]),
      "Screenshot below\n\nImage attached."
    );
  });
});

describe("supportEmailAttachmentFilename", () => {
  it("uses the storage filename when present", () => {
    assert.equal(
      supportEmailAttachmentFilename(
        { url: "https://x/community-posts/a/b.png", kind: "image" },
        0
      ),
      "b.png"
    );
  });
});
