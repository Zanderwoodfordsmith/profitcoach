import { listCampaigns } from "@/lib/unipile/campaigns";
import {
  countPeopleReachedInRange,
  countSucceededInvitesToday,
  loadActivityInRange,
  type ActivityDayCounts,
} from "@/lib/unipile/activityHeatmap";
import {
  eachYmd,
  labelCampaignWindow,
  overviewTimezone,
  parseOverviewOffset,
  parseOverviewRange,
  planInviteBuckets,
  resolveCampaignWindow,
  type OverviewRange,
  type PlannedDayBucket,
} from "@/lib/unipile/campaignPlanBuckets";
import { loadCoachLinkedInSendSettings } from "@/lib/unipile/accountSendPlan";
import {
  effectiveWeeklyCap,
  todayInviteQuota,
  weekJitterPct,
  rollingWeekKey,
} from "@/lib/unipile/accountSendSafety";
import {
  DEFAULT_CAMPAIGN_SEND_RULES,
  parseCampaignSendRules,
} from "@/lib/unipile/campaignSendWindow";

export type OverviewActualDay = {
  date: string;
  invite: number;
  message: number;
  engagement: number;
  total: number;
};

export type CampaignOverviewPayload = {
  window: {
    range: OverviewRange;
    offset: number;
    timezone: string;
    todayYmd: string;
    startYmd: string;
    endYmd: string;
    label: string;
  };
  actual: OverviewActualDay[];
  planned: PlannedDayBucket[];
  /** Total outbound actions in the window (chart volume). */
  sent: number;
  /** Distinct people touched at least once in the window. */
  peopleReached: number;
  plannedRemaining: number;
  fuelDays: number | null;
  fuelLeft: number;
};

function toChartActual(row: ActivityDayCounts): OverviewActualDay {
  const message = row.message + row.email;
  const total = row.invite + message + row.engagement;
  return {
    date: row.date,
    invite: row.invite,
    message,
    engagement: row.engagement,
    total,
  };
}

export async function loadCampaignOverview(
  coachId: string,
  rangeRaw: string | null,
  offsetRaw: string | null
): Promise<CampaignOverviewPayload> {
  const range = parseOverviewRange(rangeRaw);
  const offset = parseOverviewOffset(offsetRaw);
  const campaigns = await listCampaigns(coachId);
  const account = await loadCoachLinkedInSendSettings(coachId);
  const timezone =
    account?.timezone?.trim() || overviewTimezone(campaigns);
  const window = resolveCampaignWindow({ range, offset, timezone });

  const actualEnd =
    window.endYmd < window.todayYmd ? window.endYmd : window.todayYmd;
  const [actualRows, peopleReached] =
    window.startYmd <= window.todayYmd
      ? await Promise.all([
          loadActivityInRange(
            coachId,
            window.startYmd,
            actualEnd,
            timezone
          ),
          countPeopleReachedInRange(
            coachId,
            window.startYmd,
            actualEnd,
            timezone
          ),
        ])
      : [[], 0];
  const actualByDate = new Map(actualRows.map((row) => [row.date, row]));
  const actual = eachYmd(window.startYmd, window.endYmd).map((date) => {
    const row = actualByDate.get(date);
    if (!row || date > window.todayYmd) {
      return { date, invite: 0, message: 0, engagement: 0, total: 0 };
    }
    return toChartActual(row);
  });

  const invitesSentToday = await countSucceededInvitesToday(coachId, timezone);
  const sendRules = parseCampaignSendRules(
    account?.send_rules ?? DEFAULT_CAMPAIGN_SEND_RULES
  );
  const weekCap = account
    ? Math.max(
        20,
        Math.round(
          effectiveWeeklyCap({
            weeklyTarget: account.weekly_invite_target,
            ssiScore: account.ssi_score,
            warmupStartedAt: account.warmup_started_at,
            warmupEnabled: account.warmup_enabled !== false,
          }) *
            weekJitterPct(account.id, rollingWeekKey(window.todayYmd))
        )
      )
    : null;

  const planned = planInviteBuckets({
    campaigns: campaigns.map((c) => ({
      status: c.status,
      queued: c.progress?.queued ?? 0,
      dailyInviteLimit: Number(c.daily_invite_limit ?? 20),
      sendRules: account?.send_rules ?? c.send_rules,
      timezone: account?.timezone ?? c.timezone,
      hasInviteStep: c.has_invite_step !== false,
      outreachPriority: Number(
        (c as { outreach_priority?: number }).outreach_priority ?? 100
      ),
      outreachWeight: Number(
        (c as { outreach_weight?: number }).outreach_weight ?? 1
      ),
    })),
    window,
    invitesSentToday,
    accountPlan:
      account && weekCap != null
        ? {
            sendRules,
            dayQuota: (ymd, weekday) =>
              todayInviteQuota({
                accountId: account.id,
                ymd,
                weekday,
                weekRemaining: weekCap,
                weekCap,
                sendRules,
              }).quota,
          }
        : null,
  });

  const fuelLeft = campaigns.reduce((sum, c) => {
    if (c.status !== "running" || c.has_invite_step === false) return sum;
    return sum + (c.progress?.queued ?? 0);
  }, 0);
  const runningInvite = campaigns.some(
    (c) => c.status === "running" && c.has_invite_step !== false
  );

  return {
    window: { ...window, label: labelCampaignWindow(window) },
    actual,
    planned: planned.buckets,
    sent: actual.reduce((sum, row) => sum + row.total, 0),
    peopleReached,
    plannedRemaining: planned.plannedRemaining,
    fuelDays:
      planned.fuelDays ?? (runningInvite && fuelLeft <= 0 ? 0 : null),
    fuelLeft,
  };
}
