import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  campaignInviteDailyLimit,
  campaignMessageDailyLimit,
  evaluateOutreachSendSafety,
  sendKindFromStepType,
  SEND_HOURS_GRACE_MS,
  type OutreachSendSafetyEvalInput,
} from "@/lib/unipile/outreachSendSafety";

const now = new Date("2026-09-21T10:00:00Z");

function base(
  overrides: Partial<OutreachSendSafetyEvalInput> = {}
): OutreachSendSafetyEvalInput {
  return {
    now,
    sendAt: now,
    kind: "invite",
    rateLimitedUntil: null,
    invitePausedUntil: null,
    plan: {
      invitesAssigned: 0,
      inviteQuota: 20,
      messagesAssigned: 0,
      messageQuota: 20,
      reactsAssigned: 0,
      reactQuota: 12,
    },
    campaignInvitesToday: 0,
    campaignMessagesToday: 0,
    campaignInviteLimit: 20,
    campaignMessageLimit: 20,
    nextWindowStart: new Date("2026-09-22T07:00:00Z"),
    hoursJitterSeconds: 120,
    quotaJitterSeconds: 90,
    ...overrides,
  };
}

describe("outreachSendSafety", () => {
  it("maps step types to send kinds", () => {
    assert.equal(sendKindFromStepType("invite"), "invite");
    assert.equal(sendKindFromStepType("instagram_follow"), "invite");
    assert.equal(sendKindFromStepType("message"), "message");
    assert.equal(sendKindFromStepType("instagram"), "message");
    assert.equal(sendKindFromStepType("follow"), "other");
  });

  it("clamps campaign daily limits", () => {
    assert.equal(campaignInviteDailyLimit(null), 20);
    assert.equal(campaignInviteDailyLimit(9), 9);
    assert.equal(campaignInviteDailyLimit(999), 250);
    assert.equal(campaignMessageDailyLimit(0), 1);
    assert.equal(campaignMessageDailyLimit(50), 50);
    assert.equal(campaignMessageDailyLimit(500), 100);
  });

  it("allows a send inside hours under both caps", () => {
    const result = evaluateOutreachSendSafety(base());
    assert.equal(result.ok, true);
  });

  it("defers outside sending hours with jitter", () => {
    const sendAt = new Date(now.getTime() + 60 * 60 * 1000);
    const result = evaluateOutreachSendSafety(base({ sendAt }));
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "Outside sending hours; deferred.");
    assert.equal(result.deferUntil.getTime(), sendAt.getTime() + 120_000);
  });

  it("allows sends within the 15s hours grace", () => {
    const sendAt = new Date(now.getTime() + SEND_HOURS_GRACE_MS - 1);
    const result = evaluateOutreachSendSafety(base({ sendAt }));
    assert.equal(result.ok, true);
  });

  it("blocks invites at the campaign daily invite limit", () => {
    const result = evaluateOutreachSendSafety(
      base({ campaignInvitesToday: 9, campaignInviteLimit: 9 })
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "Campaign daily invite limit reached; deferred.");
  });

  it("blocks messages at the campaign daily message limit", () => {
    const result = evaluateOutreachSendSafety(
      base({
        kind: "message",
        campaignMessagesToday: 20,
        campaignMessageLimit: 20,
      })
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(
      result.reason,
      "Campaign daily message limit reached; deferred."
    );
  });

  it("blocks when the tighter campaign cap is below the account quota", () => {
    const result = evaluateOutreachSendSafety(
      base({
        plan: {
          invitesAssigned: 5,
          inviteQuota: 20,
          messagesAssigned: 0,
          messageQuota: 20,
          reactsAssigned: 0,
          reactQuota: 12,
        },
        campaignInvitesToday: 9,
        campaignInviteLimit: 9,
      })
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "Campaign daily invite limit reached; deferred.");
  });

  it("blocks at the account quota even if the campaign still has room", () => {
    const result = evaluateOutreachSendSafety(
      base({
        plan: {
          invitesAssigned: 12,
          inviteQuota: 12,
          messagesAssigned: 0,
          messageQuota: 20,
          reactsAssigned: 0,
          reactQuota: 12,
        },
        campaignInvitesToday: 3,
        campaignInviteLimit: 20,
      })
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "Account daily limit reached; deferred.");
  });

  it("applies campaign message limits to remind-style message sends", () => {
    const result = evaluateOutreachSendSafety(
      base({
        kind: "message",
        campaignMessagesToday: 8,
        campaignMessageLimit: 8,
        plan: {
          invitesAssigned: 0,
          inviteQuota: 20,
          messagesAssigned: 2,
          messageQuota: 20,
          reactsAssigned: 0,
          reactQuota: 12,
        },
      })
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(
      result.reason,
      "Campaign daily message limit reached; deferred."
    );
  });

  it("defers rate-limited accounts first", () => {
    const until = new Date("2026-09-21T12:00:00Z");
    const result = evaluateOutreachSendSafety(
      base({
        rateLimitedUntil: until,
        campaignInvitesToday: 99,
        campaignInviteLimit: 1,
      })
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "Account rate-limited; deferred.");
    assert.equal(result.deferUntil.getTime(), until.getTime());
  });
});
