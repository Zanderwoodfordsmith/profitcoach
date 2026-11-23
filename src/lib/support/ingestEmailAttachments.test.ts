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

  it("keeps a Gmail file that has a cid but inline false", () => {
    const parsed = parseUnipileEmailAttachmentMeta([
      { id: "pdf", name: "deck.pdf", mime: "application/pdf", cid: "f_abc", inline: false },
    ]);
    assert.equal(parsed[0]?.inline, false);
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

  it("ingests a pdf document", () => {
    const result = classifySupportEmailAttachment({
      id: "1",
      name: "invoice.pdf",
      mime: "application/pdf",
      size: 40_000,
      inline: false,
    });
    assert.equal(result.ingest, true);
    if (result.ingest) assert.equal(result.kind, "file");
  });

  it("ingests a zip as a download-only file", () => {
    const result = classifySupportEmailAttachment({
      id: "1",
      name: "Campaign-Prospects.zip",
      mime: "application/zip",
      size: 40_000,
      inline: false,
    });
    assert.equal(result.ingest, true);
    if (result.ingest) {
      assert.equal(result.kind, "file");
      assert.equal(result.mime, "application/octet-stream");
    }
  });

  it("skips programs", () => {
    const result = classifySupportEmailAttachment({
      id: "1",
      name: "setup.exe",
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
