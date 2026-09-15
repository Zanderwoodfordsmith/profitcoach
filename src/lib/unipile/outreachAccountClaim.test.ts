import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  shouldClaimRecentUnclaimedMailingAccount,
  shouldClaimUnclaimedUnipileAccount,
} from "./outreachAccounts";

describe("shouldClaimUnclaimedUnipileAccount", () => {
  const coachId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

  it("claims only when hosted auth stamped this coach id", () => {
    assert.equal(shouldClaimUnclaimedUnipileAccount(coachId, coachId), true);
  });

  it("does not claim an unclaimed Google just because this coach has none", () => {
    assert.equal(
      shouldClaimUnclaimedUnipileAccount("Hillary McNair", coachId),
      false
    );
    assert.equal(shouldClaimUnclaimedUnipileAccount("", coachId), false);
    assert.equal(
      shouldClaimUnclaimedUnipileAccount("bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee", coachId),
      false
    );
  });
});

describe("shouldClaimRecentUnclaimedMailingAccount", () => {
  const coachId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
  const nowMs = Date.parse("2026-09-15T03:10:00.000Z");

  it("still claims when hosted auth stamped the coach id", () => {
    assert.equal(
      shouldClaimRecentUnclaimedMailingAccount({
        accountName: coachId,
        coachId,
        provider: "GOOGLE",
        createdAt: "2020-01-01T00:00:00.000Z",
        coachHasAccountForProvider: true,
        nowMs,
      }),
      true
    );
  });

  it("claims a just-created unclaimed Gmail when this coach has none", () => {
    assert.equal(
      shouldClaimRecentUnclaimedMailingAccount({
        accountName: "zander@businesscoachacademy.com",
        coachId,
        provider: "GOOGLE",
        createdAt: "2026-09-15T03:00:57.570Z",
        coachHasAccountForProvider: false,
        nowMs,
      }),
      true
    );
  });

  it("does not claim Hillary's leftover Google", () => {
    assert.equal(
      shouldClaimRecentUnclaimedMailingAccount({
        accountName: "hilarymcnairprofitcoach@gmail.com",
        coachId,
        provider: "GOOGLE",
        createdAt: "2026-01-01T00:00:00.000Z",
        coachHasAccountForProvider: false,
        nowMs,
      }),
      false
    );
  });

  it("does not claim a second Google when this coach already has one", () => {
    assert.equal(
      shouldClaimRecentUnclaimedMailingAccount({
        accountName: "zander@businesscoachacademy.com",
        coachId,
        provider: "GOOGLE",
        createdAt: "2026-09-15T03:00:57.570Z",
        coachHasAccountForProvider: true,
        nowMs,
      }),
      false
    );
  });

  it("does not claim LinkedIn this way", () => {
    assert.equal(
      shouldClaimRecentUnclaimedMailingAccount({
        accountName: "Zander Woodford-Smith",
        coachId,
        provider: "LINKEDIN",
        createdAt: "2026-09-15T03:00:57.570Z",
        coachHasAccountForProvider: false,
        nowMs,
      }),
      false
    );
  });
});
