import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sanitizeShareUrl } from "./sanitizeUrl";

describe("sanitizeShareUrl", () => {
  it("accepts https URLs", () => {
    const result = sanitizeShareUrl("https://instagram.com/acme");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.url, "https://instagram.com/acme");
    }
  });

  it("adds https when the scheme is missing", () => {
    const result = sanitizeShareUrl("youtube.com/@acme");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.url, "https://youtube.com/@acme");
    }
  });

  it("rejects javascript URLs", () => {
    const result = sanitizeShareUrl("javascript:alert(1)");
    assert.equal(result.ok, false);
  });

  it("rejects data URLs", () => {
    const result = sanitizeShareUrl("data:text/html,hi");
    assert.equal(result.ok, false);
  });

  it("rejects public IPv4 hosts", () => {
    const result = sanitizeShareUrl("http://8.8.8.8/foo");
    assert.equal(result.ok, false);
  });
});
