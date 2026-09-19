import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifySupportEmailAttachment,
  formatSkippedEmailAttachmentNote,
  parseUnipileEmailAttachmentMeta,
} from "./ingestEmailAttachments";

describe("parseUnipileEmailAttachmentMeta", () => {
  it("keeps attachments that have an id", () => {
    const parsed = parseUnipileEmailAttachmentMeta([
      { id: "a1", name: "shot.png", mime: "image/png", size: 1200, inline: false },
      { name: "missing-id.png", mime: "image/png" },
    ]);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0]?.id, "a1");
    assert.equal(parsed[0]?.inline, false);
  });

  it("treats cid as inline signature clutter", () => {
    const parsed = parseUnipileEmailAttachmentMeta([
      { id: "sig", name: "logo.png", mime: "image/png", cid: "logo@mail" },
    ]);
    assert.equal(parsed[0]?.inline, true);
  });
});

describe("classifySupportEmailAttachment", () => {
  it("ingests a png screenshot", () => {
    const result = classifySupportEmailAttachment({
      id: "1",
      name: "bug.png",
      mime: "image/png",
      size: 80_000,
      inline: false,
    });
    assert.equal(result.ingest, true);
    if (result.ingest) {
      assert.equal(result.kind, "image");
    }
  });

  it("skips inline images", () => {
    const result = classifySupportEmailAttachment({
      id: "1",
      name: "logo.png",
      mime: "image/png",
      size: 2000,
      inline: true,
    });
    assert.deepEqual(result, { ingest: false, reason: "inline" });
  });

  it("skips pdfs for the thread gallery", () => {
    const result = classifySupportEmailAttachment({
      id: "1",
      name: "invoice.pdf",
      mime: "application/pdf",
      size: 40_000,
      inline: false,
    });
    assert.deepEqual(result, { ingest: false, reason: "unsupported" });
  });
});

describe("formatSkippedEmailAttachmentNote", () => {
  it("lists unique filenames", () => {
    assert.equal(
      formatSkippedEmailAttachmentNote(["invoice.pdf", " invoice.pdf "]),
      "\n\nAlso attached (not shown here): invoice.pdf"
    );
  });
});
