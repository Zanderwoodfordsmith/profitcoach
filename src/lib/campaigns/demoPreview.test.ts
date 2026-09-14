import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDemoCampaignOverview,
  demoPreviewActivityFeed,
  demoPreviewCampaigns,
  demoPreviewRemindQueue,
  isDemoPreviewId,
} from "./demoPreview";

const NOW = new Date("2026-09-13T12:00:00.000Z");

describe("demo campaign preview", () => {
  it("includes running invite campaigns and a paused future list", () => {
    const campaigns = demoPreviewCampaigns(NOW);
    const runningInvite = campaigns.filter(
      (c) => c.status === "running" && c.has_invite_step
    );
    const queued = runningInvite.reduce(
      (sum, c) => sum + (c.progress?.queued ?? 0),
      0
    );
    const sent = runningInvite.reduce(
      (sum, c) => sum + (c.progress?.sent ?? 0),
      0
    );
    assert.ok(sent > 400);
    assert.ok(queued > 500);
    assert.ok(campaigns.some((c) => c.status === "paused" && (c.progress?.queued ?? 0) > 100));
    assert.ok(campaigns.every((c) => isDemoPreviewId(c.id)));
  });

  it("fills this week densely and later weeks with planned invites", () => {
    const thisWeek = buildDemoCampaignOverview("week", 0, NOW);
    assert.equal(thisWeek.window.todayYmd, "2026-09-13");
    assert.ok(thisWeek.sent > 200);
    assert.ok(
      thisWeek.actual.some((row) => row.date < thisWeek.window.todayYmd && row.invite >= 20)
    );

    const nextWeek = buildDemoCampaignOverview("week", 1, NOW);
    assert.ok(nextWeek.plannedRemaining >= 100);

    const thisMonth = buildDemoCampaignOverview("month", 0, NOW);
    assert.ok(thisMonth.sent > 400);
    assert.ok(thisMonth.plannedRemaining >= 200);
  });

  it("fills due, sent, and planned lists", () => {
    const remind = demoPreviewRemindQueue(NOW);
    assert.ok(remind.counts.due + remind.counts.overdue >= 8);
    assert.ok(remind.queue.length >= 12);

    const feed = demoPreviewActivityFeed(NOW);
    assert.ok(feed.sent.length >= 40);
    assert.ok(feed.planned.length + feed.waiting.length >= 50);
    assert.equal(feed.dueCount, remind.counts.due + remind.counts.overdue);
  });
});
