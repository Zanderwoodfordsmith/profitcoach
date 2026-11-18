import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isCronRequest } from "./cronAuth";

function req(headers: Record<string, string>): Request {
  return new Request("https://example.com/api/cron", { headers });
}

describe("isCronRequest", () => {
  process.env.CRON_SECRET = "test-secret-123";

  it("accepts the cron secret", () => {
    assert.equal(
      isCronRequest(req({ authorization: "Bearer test-secret-123" })),
      true
    );
  });

  it("rejects a wrong secret", () => {
    assert.equal(
      isCronRequest(req({ authorization: "Bearer test-secret-124" })),
      false
    );
  });

  it("rejects Vercel-looking headers without the secret", () => {
    assert.equal(
      isCronRequest(
        req({
          "user-agent": "vercel-cron/1.0",
          "x-vercel-cron-schedule": "* * * * *",
          "x-vercel-cron": "1",
        })
      ),
      false
    );
  });

  it("rejects a bare browser GET", () => {
    assert.equal(
      isCronRequest(req({ "user-agent": "Mozilla/5.0" })),
      false
    );
  });

  it("rejects everything when no secret is set", () => {
    const saved = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    assert.equal(isCronRequest(req({ authorization: "Bearer " })), false);
    assert.equal(
      isCronRequest(req({ authorization: "Bearer test-secret-123" })),
      false
    );
    process.env.CRON_SECRET = saved;
  });
});
