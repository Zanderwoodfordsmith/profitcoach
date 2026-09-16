import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isCronRequest } from "./cronAuth";

function req(headers: Record<string, string>): Request {
  return new Request("https://example.com/api/cron", { headers });
}

describe("isCronRequest", () => {
  it("accepts current Vercel cron user-agent", () => {
    assert.equal(
      isCronRequest(req({ "user-agent": "vercel-cron/1.0" })),
      true
    );
  });

  it("accepts x-vercel-cron-schedule", () => {
    assert.equal(
      isCronRequest(req({ "x-vercel-cron-schedule": "* * * * *" })),
      true
    );
  });

  it("accepts legacy x-vercel-cron: 1", () => {
    assert.equal(isCronRequest(req({ "x-vercel-cron": "1" })), true);
  });

  it("rejects a bare browser GET", () => {
    assert.equal(
      isCronRequest(req({ "user-agent": "Mozilla/5.0" })),
      false
    );
  });
});
