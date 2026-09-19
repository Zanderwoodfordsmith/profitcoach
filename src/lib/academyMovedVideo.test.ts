import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveAcademyMovedMedia } from "./academyMovedVideo";

describe("resolveAcademyMovedMedia", () => {
  it("returns null for an empty or javascript URL", () => {
    assert.equal(resolveAcademyMovedMedia(""), null);
    assert.equal(resolveAcademyMovedMedia("javascript:alert(1)"), null);
  });

  it("embeds YouTube, Loom, and Wistia over https only", () => {
    assert.deepEqual(
      resolveAcademyMovedMedia("https://youtu.be/dQw4w9WgXcQ"),
      {
        kind: "embed",
        embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0",
      }
    );
    assert.deepEqual(
      resolveAcademyMovedMedia("https://www.loom.com/share/abcDEF123"),
      { kind: "embed", embedUrl: "https://www.loom.com/embed/abcDEF123" }
    );
    assert.deepEqual(
      resolveAcademyMovedMedia("https://profitcoach.wistia.com/medias/hashedid1"),
      {
        kind: "embed",
        embedUrl: "https://fast.wistia.net/embed/iframe/hashedid1",
      }
    );
  });

  it("rejects http files and unknown hosts", () => {
    assert.equal(
      resolveAcademyMovedMedia("http://example.com/walkthrough.mp4"),
      null
    );
    assert.equal(
      resolveAcademyMovedMedia("https://evil.example/embed/abc"),
      null
    );
  });
});
