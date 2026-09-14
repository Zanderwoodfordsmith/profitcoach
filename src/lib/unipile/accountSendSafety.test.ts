import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  acceptRateStatus,
  actionDelaySeconds,
  buildDailySendPlan,
  clampWeeklyInviteTarget,
  dayJitterFactor,
  effectiveWeeklyCap,
  hashUnit,
  recommendedWeeklyInvites,
  sprinkleSendTimes,
  todayInviteQuota,
  warmupMultiplier,
  warmupWeekIndex,
  weekdayWeightsForRules,
  weekJitterPct,
} from "@/lib/unipile/accountSendSafety";
import { DEFAULT_CAMPAIGN_SEND_RULES } from "@/lib/unipile/campaignSendWindow";

describe("accountSendSafety", () => {
  it("recommends 100 under SSI 70 and 200 at/above", () => {
    assert.equal(recommendedWeeklyInvites(null), 100);
    assert.equal(recommendedWeeklyInvites(69), 100);
    assert.equal(recommendedWeeklyInvites(70), 200);
    assert.equal(recommendedWeeklyInvites(90), 200);
  });

  it("clamps weekly target", () => {
    assert.equal(clampWeeklyInviteTarget(10), 20);
    assert.equal(clampWeeklyInviteTarget(250), 200);
    assert.equal(clampWeeklyInviteTarget(150), 150);
  });

  it("applies warm-up weeks", () => {
    assert.equal(warmupMultiplier(1, null), 0.2);
    assert.equal(warmupMultiplier(1, 50), 0.3);
    assert.equal(warmupMultiplier(2, 50), 0.6);
    assert.equal(warmupMultiplier(3, 50), 0.9);
    assert.equal(warmupMultiplier(4, 50), 1);
  });

  it("computes effective weekly cap with warm-up", () => {
    const now = new Date("2026-09-14T12:00:00Z");
    const started = new Date("2026-09-14T10:00:00Z");
    assert.equal(
      effectiveWeeklyCap({
        weeklyTarget: 100,
        ssiScore: 55,
        warmupStartedAt: started,
        now,
      }),
      30
    );
  });

  it("skips warm-up ramp when disabled", () => {
    const now = new Date("2026-09-14T12:00:00Z");
    const started = new Date("2026-09-14T10:00:00Z");
    assert.equal(
      effectiveWeeklyCap({
        weeklyTarget: 100,
        ssiScore: 55,
        warmupStartedAt: started,
        warmupEnabled: false,
        now,
      }),
      100
    );
  });

  it("warmup week index advances every 7 days", () => {
    const start = new Date("2026-09-01T00:00:00Z");
    assert.equal(warmupWeekIndex(start, new Date("2026-09-01T12:00:00Z")), 1);
    assert.equal(warmupWeekIndex(start, new Date("2026-09-08T12:00:00Z")), 2);
    assert.equal(warmupWeekIndex(start, new Date("2026-09-22T12:00:00Z")), 4);
  });

  it("front-loads Tue/Mon in weekday weights", () => {
    const weights = weekdayWeightsForRules(DEFAULT_CAMPAIGN_SEND_RULES);
    assert.ok((weights.get(2) ?? 0) > (weights.get(1) ?? 0));
    assert.ok((weights.get(1) ?? 0) > (weights.get(3) ?? 0));
    assert.ok((weights.get(5) ?? 0) < (weights.get(4) ?? 0));
    const sum = [...weights.values()].reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9);
  });

  it("varies daily invite quota with mix and jitter", () => {
    const tue = todayInviteQuota({
      accountId: "acc-1",
      ymd: "2026-09-15",
      weekday: 2,
      weekRemaining: 100,
      weekCap: 100,
      sendRules: DEFAULT_CAMPAIGN_SEND_RULES,
    });
    const fri = todayInviteQuota({
      accountId: "acc-1",
      ymd: "2026-09-18",
      weekday: 5,
      weekRemaining: 100,
      weekCap: 100,
      sendRules: DEFAULT_CAMPAIGN_SEND_RULES,
    });
    assert.ok(tue.quota > fri.quota);
    assert.ok(tue.quota >= 15 && tue.quota <= 40);
  });

  it("builds a daily plan with quotas", () => {
    const plan = buildDailySendPlan({
      accountId: "acc-1",
      ymd: "2026-09-15",
      weekday: 2,
      weeklyTarget: 100,
      ssiScore: 80,
      warmupStartedAt: new Date("2026-01-01T00:00:00Z"),
      invitesSentRolling7d: 10,
      dailyMessageTarget: 20,
      dailyReactTarget: 12,
      sendRules: DEFAULT_CAMPAIGN_SEND_RULES,
      now: new Date("2026-09-15T08:00:00Z"),
    });
    assert.equal(plan.ymd, "2026-09-15");
    assert.ok(plan.weekCap >= 90 && plan.weekCap <= 200);
    assert.ok(plan.inviteQuota > 0);
    assert.ok(plan.messageQuota >= 1);
  });

  it("sprinkles times across the window without clustering at start", () => {
    const start = new Date("2026-09-15T07:00:00Z");
    const end = new Date("2026-09-15T18:00:00Z");
    const times = sprinkleSendTimes({
      count: 10,
      windowStart: start,
      windowEnd: end,
      minGapSeconds: 240,
      seed: "acc-1:2026-09-15",
      now: start,
    });
    assert.equal(times.length, 10);
    for (let i = 1; i < times.length; i += 1) {
      assert.ok(times[i]!.getTime() >= times[i - 1]!.getTime());
    }
    const first = times[0]!.getTime() - start.getTime();
    const last = end.getTime() - times[times.length - 1]!.getTime();
    // Not all piled at the open.
    assert.ok(first < 3 * 3600 * 1000 || last < 6 * 3600 * 1000);
  });

  it("accept rate warns under 30% and pause-hints under 15%", () => {
    const ok = acceptRateStatus(20, 50);
    assert.equal(ok.warn, false);
    assert.equal(ok.pauseHint, false);
    const warn = acceptRateStatus(12, 50);
    assert.equal(warn.warn, true);
    assert.equal(warn.pauseHint, false);
    const pause = acceptRateStatus(5, 50);
    assert.equal(pause.warn, true);
    assert.equal(pause.pauseHint, true);
    const small = acceptRateStatus(1, 10);
    assert.equal(small.rate, null);
  });

  it("hash-based jitter is stable for a seed", () => {
    assert.equal(hashUnit("a"), hashUnit("a"));
    assert.notEqual(weekJitterPct("a", "w1"), weekJitterPct("b", "w1"));
    const j = dayJitterFactor("acc", "2026-09-15");
    assert.ok(j >= 0.85 && j <= 1.15);
  });

  it("action delay stays within min/max", () => {
    const d = actionDelaySeconds(180, 480, "job-1");
    assert.ok(d >= 180 && d <= 480);
  });
});
