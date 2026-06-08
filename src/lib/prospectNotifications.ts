import type { ProspectRow } from "@/lib/prospectRow";
import { formatProspectPersonName } from "@/lib/prospectDisplayFormat";

export type ProspectFunnel = "boss_scorecard" | "diagnostic_50";

export type ProspectNotificationKind = "boss_score" | "boss_score_pro";

export type ProspectNotificationStatus = "started" | "completed";

export type ProspectNotificationItem = {
  id: string;
  created_at: string;
  contact_id: string;
  contact_name: string;
  business_name: string | null;
  kind: ProspectNotificationKind;
  status: ProspectNotificationStatus;
  score: number | null;
  coach_name: string | null;
  href: string;
  title: string;
  body: string;
};

const PRODUCT_LABEL: Record<ProspectNotificationKind, string> = {
  boss_score: "BOSS Score",
  boss_score_pro: "BOSS Score Pro",
};

export function prospectNotificationId(
  contactId: string,
  status: ProspectNotificationStatus
): string {
  return `prospect:${contactId}:${status}`;
}

function funnelToKind(
  funnel: ProspectFunnel | null | undefined
): ProspectNotificationKind {
  return funnel === "diagnostic_50" ? "boss_score_pro" : "boss_score";
}

function productLabel(kind: ProspectNotificationKind): string {
  return PRODUCT_LABEL[kind];
}

function buildTitle(
  contactName: string,
  kind: ProspectNotificationKind,
  status: ProspectNotificationStatus
): string {
  const verb = status === "started" ? "started" : "completed";
  return `${contactName} ${verb} ${productLabel(kind)}`;
}

function buildBody(
  row: ProspectRow,
  kind: ProspectNotificationKind,
  status: ProspectNotificationStatus,
  score: number | null
): string {
  const parts: string[] = [];
  if (row.business_name?.trim()) parts.push(row.business_name.trim());
  if (row.email?.trim()) parts.push(row.email.trim());
  if (status === "completed" && score != null) {
    parts.push(`Score ${Math.round(score)}`);
  }
  if (row.coach_name?.trim()) parts.push(row.coach_name.trim());
  if (parts.length > 0) return parts.join(" · ");
  return status === "started"
    ? `Started ${productLabel(kind)}`
    : `Completed ${productLabel(kind)}`;
}

function resolveCompletedNotification(
  row: ProspectRow,
  prospectsHref: string
): ProspectNotificationItem | null {
  const bossScoreAt = row.boss_score_at;
  const bossProAt =
    row.boss_score_premium_source === "diagnostic"
      ? row.boss_score_premium_at
      : null;

  if (!bossScoreAt && !bossProAt) return null;

  const scoreAt = bossScoreAt ? new Date(bossScoreAt).getTime() : -1;
  const proAt = bossProAt ? new Date(bossProAt).getTime() : -1;

  const usePro = proAt >= scoreAt && bossProAt;
  const kind: ProspectNotificationKind = usePro ? "boss_score_pro" : "boss_score";
  const created_at = usePro ? bossProAt! : bossScoreAt!;
  const score = usePro ? row.boss_score_premium : row.boss_score;
  const contactName = formatProspectPersonName(row.full_name) || "Prospect";

  return {
    id: prospectNotificationId(row.id, "completed"),
    created_at,
    contact_id: row.id,
    contact_name: contactName,
    business_name: row.business_name,
    kind,
    status: "completed",
    score: score ?? null,
    coach_name: row.coach_name ?? null,
    href: prospectsHref,
    title: buildTitle(contactName, kind, "completed"),
    body: buildBody(row, kind, "completed", score ?? null),
  };
}

function resolveStartedNotification(
  row: ProspectRow,
  prospectsHref: string
): ProspectNotificationItem | null {
  if (row.last_assessed_at) return null;

  const funnel = row.prospect_funnel as ProspectFunnel | null | undefined;
  if (!funnel) return null;

  const created_at = row.created_at;
  if (!created_at) return null;

  const kind = funnelToKind(funnel);
  const contactName = formatProspectPersonName(row.full_name) || "Prospect";

  return {
    id: prospectNotificationId(row.id, "started"),
    created_at,
    contact_id: row.id,
    contact_name: contactName,
    business_name: row.business_name,
    kind,
    status: "started",
    score: null,
    coach_name: row.coach_name ?? null,
    href: prospectsHref,
    title: buildTitle(contactName, kind, "started"),
    body: buildBody(row, kind, "started", null),
  };
}

/** One notification per prospect — completed replaces started for the same contact. */
export function buildProspectNotifications(
  rows: ProspectRow[],
  prospectsHref: string,
  limit = 40
): ProspectNotificationItem[] {
  const items: ProspectNotificationItem[] = [];

  for (const row of rows) {
    const completed = resolveCompletedNotification(row, prospectsHref);
    if (completed) {
      items.push(completed);
      continue;
    }

    const started = resolveStartedNotification(row, prospectsHref);
    if (started) items.push(started);
  }

  items.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return items.slice(0, limit);
}
