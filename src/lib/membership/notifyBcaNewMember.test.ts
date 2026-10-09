import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";

import {
  buildInboundMemberBody,
  memberWebhookTarget,
  signMemberWebhook,
} from "./notifyBcaNewMember";

describe("notifyBcaNewMember", () => {
  it("signs the exact body the receiver checks", () => {
    const rawBody = buildInboundMemberBody({
      pcCoachId: "85003B71-3F89-4672-94CC-A40CE4C3685E",
      fullName: "Paul Hamnett",
      email: "Paul@Example.com",
      slug: "paul-hamnett",
      joinedAt: "2026-10-01T12:48:45.632Z",
    });
    const timestamp = "1750000000000";
    const secret = "test-secret";
    const signature = signMemberWebhook(secret, timestamp, rawBody);
    const expected = createHmac("sha256", secret)
      .update(`${timestamp}.${rawBody}`)
      .digest("hex");
    assert.equal(signature, expected);
    assert.deepEqual(JSON.parse(rawBody), {
      pcCoachId: "85003b71-3f89-4672-94cc-a40ce4c3685e",
      fullName: "Paul Hamnett",
      joinedAt: "2026-10-01T12:48:45.632Z",
      email: "paul@example.com",
      slug: "paul-hamnett",
    });
  });

  it("drops a slug that the receiver would reject", () => {
    const rawBody = buildInboundMemberBody({
      pcCoachId: "85003b71-3f89-4672-94cc-a40ce4c3685e",
      fullName: "Paul Hamnett",
      email: null,
      slug: "Paul Hamnett",
      joinedAt: "2026-10-01T12:48:45.632Z",
    });
    assert.equal(JSON.parse(rawBody).slug, undefined);
  });

  it("only allows the live site or local dev", () => {
    const previous = process.env.BCA_MEMBER_WEBHOOK_URL;
    process.env.BCA_MEMBER_WEBHOOK_URL =
      "https://businesscoachacademy.com/api/webhooks/profit-coach/member";
    assert.equal(
      memberWebhookTarget(),
      "https://businesscoachacademy.com/api/webhooks/profit-coach/member"
    );
    process.env.BCA_MEMBER_WEBHOOK_URL = "https://evil.example/hook";
    assert.equal(memberWebhookTarget(), null);
    if (previous === undefined) delete process.env.BCA_MEMBER_WEBHOOK_URL;
    else process.env.BCA_MEMBER_WEBHOOK_URL = previous;
  });
});
