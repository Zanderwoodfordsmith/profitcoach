import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  labelCampaignWindow,
  planInviteBuckets,
  resolveCampaignWindow,
} from "./campaignPlanBuckets";

const TZ = "Europe/London";
const MON_FRI = [1, 2, 3, 4, 5].map((weekday) => ({
  weekday,
  start_time: "07:00",
  end_time: "18:00",
}));

function campaign(overrides: Partial<Parameters<typeof planInviteBuckets>[0]["campaigns"][0]> = {}) {
  return {
    status: "running",
    queued: 40,
    dailyInviteLimit: 20,
    sendRules: MON_FRI,
    timezone: TZ,
    hasInviteStep: true,
    ...overrides,
  };
}

describe("resolveCampaignWindow", () => {
  it("starts the week on Monday", () => {
    const window = resolveCampaignWindow({
      range: "week",
      offset: 0,
      timezone: TZ,
      now: new Date("2026-09-09T12:00:00.000Z"),
    });
    assert.equal(window.todayYmd, "2026-09-09");
    assert.equal(window.startYmd, "2026-09-07");
    assert.equal(window.endYmd, "2026-09-13");
    assert.equal(labelCampaignWindow(window), "7th–13th Sep");
  });

  it("uses both months when a week spans them", () => {
    const window = resolveCampaignWindow({
      range: "week",
      offset: -1,
      timezone: TZ,
      now: new Date("2026-09-09T12:00:00.000Z"),
    });
    assert.equal(window.startYmd, "2026-08-31");
    assert.equal(window.endYmd, "2026-09-06");
    assert.equal(labelCampaignWindow(window), "31st Aug–6th Sep");
  });

  it("labels quarter, year, and month without this/last prefixes", () => {
    const quarter = resolveCampaignWindow({
      range: "quarter",
      offset: 0,
      timezone: TZ,
      now: new Date("2026-09-09T12:00:00.000Z"),
    });
    assert.equal(quarter.startYmd, "2026-07-01");
    assert.equal(quarter.endYmd, "2026-09-30");
    assert.equal(labelCampaignWindow(quarter), "Q3 2026");

    const year = resolveCampaignWindow({
      range: "year",
      offset: 0,
      timezone: TZ,
      now: new Date("2026-09-09T12:00:00.000Z"),
    });
    assert.equal(year.startYmd, "2026-01-01");
    assert.equal(year.endYmd, "2026-12-31");
    assert.equal(labelCampaignWindow(year), "2026");

    const month = resolveCampaignWindow({
      range: "month",
      offset: 0,
      timezone: TZ,
      now: new Date("2026-09-09T12:00:00.000Z"),
    });
    assert.equal(labelCampaignWindow(month), "September 2026");
  });

  it("shifts next week and this month", () => {
    const next = resolveCampaignWindow({
      range: "week",
      offset: 1,
      timezone: TZ,
      now: new Date("2026-09-09T12:00:00.000Z"),
    });
    assert.equal(next.startYmd, "2026-09-14");
    assert.equal(next.endYmd, "2026-09-20");

    const month = resolveCampaignWindow({
      range: "month",
      offset: 0,
      timezone: TZ,
      now: new Date("2026-09-09T12:00:00.000Z"),
    });
    assert.equal(month.startYmd, "2026-09-01");
    assert.equal(month.endYmd, "2026-09-30");
  });
});

describe("planInviteBuckets", () => {
  it("fills remaining today then following send days", () => {
    const window = resolveCampaignWindow({
      range: "week",
      offset: 0,
      timezone: TZ,
      now: new Date("2026-09-09T12:00:00.000Z"),
    });
    const { buckets, plannedRemaining } = planInviteBuckets({
      campaigns: [campaign()],
      window,
      invitesSentToday: 5,
    });
    const byDate = Object.fromEntries(buckets.map((b) => [b.date, b.planned]));
    assert.equal(byDate["2026-09-07"], 0);
    assert.equal(byDate["2026-09-08"], 0);
    assert.equal(byDate["2026-09-09"], 15);
    assert.equal(byDate["2026-09-10"], 20);
    assert.equal(byDate["2026-09-11"], 5);
    assert.equal(byDate["2026-09-12"], 0);
    assert.equal(byDate["2026-09-13"], 0);
    assert.equal(plannedRemaining, 40);
  });

  it("consumes this week before showing next week", () => {
    const window = resolveCampaignWindow({
      range: "week",
      offset: 1,
      timezone: TZ,
      now: new Date("2026-09-09T12:00:00.000Z"),
    });
    const { buckets, plannedRemaining } = planInviteBuckets({
      campaigns: [campaign({ queued: 100 })],
      window,
      invitesSentToday: 0,
    });
    const byDate = Object.fromEntries(buckets.map((b) => [b.date, b.planned]));
    assert.equal(byDate["2026-09-14"], 20);
    assert.equal(byDate["2026-09-15"], 20);
    assert.equal(byDate["2026-09-16"], 0);
    assert.equal(plannedRemaining, 40);
  });

  it("ignores paused campaigns and shared today's used count", () => {
    const window = resolveCampaignWindow({
      range: "week",
      offset: 0,
      timezone: TZ,
      now: new Date("2026-09-09T12:00:00.000Z"),
    });
    const { buckets } = planInviteBuckets({
      campaigns: [
        campaign({ queued: 20, dailyInviteLimit: 20 }),
        campaign({ queued: 20, dailyInviteLimit: 20 }),
        campaign({ status: "paused", queued: 50 }),
      ],
      window,
      invitesSentToday: 15,
    });
    const today = buckets.find((b) => b.date === "2026-09-09");
    assert.equal(today?.planned, 5);
  });
});
