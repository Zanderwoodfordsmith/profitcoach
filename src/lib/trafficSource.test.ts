import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cleanTag, cleanTraffic, taggedLink, trafficFromParams, trafficLabel } from "./trafficSource";

describe("traffic source tags", () => {
  it("reads utm_source, or the short src", () => {
    assert.deepEqual(trafficFromParams(new URLSearchParams("utm_source=LinkedIn&utm_campaign=Oct%20Post")), {
      source: "linkedin",
      medium: null,
      campaign: "oct-post",
    });
    assert.equal(trafficFromParams(new URLSearchParams("src=youtube"))?.source, "youtube");
    assert.equal(trafficFromParams(new URLSearchParams("coach=pam")), null);
  });

  it("keeps tags short and plain", () => {
    assert.equal(cleanTag("  Networking Event!! 2026 "), "networking-event-2026");
    assert.equal(cleanTag("<script>"), "script");
    assert.equal(cleanTag("x".repeat(80)).length, 40);
    assert.equal(cleanTraffic({ source: "" }), null);
    assert.equal(cleanTraffic("linkedin"), null);
  });

  it("makes a tagged link and keeps existing query params", () => {
    assert.equal(
      taggedLink("https://theprofitcoach.com/score/pam?x=1", "linkedin", "Oct post"),
      "https://theprofitcoach.com/score/pam?x=1&utm_source=linkedin&utm_medium=social&utm_campaign=oct-post"
    );
    assert.equal(taggedLink("https://theprofitcoach.com/score/pam", "Podcast"), "https://theprofitcoach.com/score/pam?utm_source=podcast");
  });

  it("labels known channels", () => {
    assert.equal(trafficLabel("qr"), "QR code");
    assert.equal(trafficLabel("networking-event"), "networking event");
    assert.equal(trafficLabel(null), null);
  });
});
