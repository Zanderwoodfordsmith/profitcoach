import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type UsageSessionRow = {
  user_id: string;
  role: string | null;
  started_at: string;
  last_activity_at: string;
  ended_at: string | null;
  page_views: number | null;
  heartbeat_count: number | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_SESSION_SECONDS = 12 * 60 * 60;

function sessionDurationSeconds(row: UsageSessionRow): number {
  const started = Date.parse(row.started_at);
  const endedCandidate = Date.parse(row.ended_at ?? row.last_activity_at);
  if (Number.isNaN(started) || Number.isNaN(endedCandidate)) return 0;
  return Math.max(0, Math.min(MAX_SESSION_SECONDS, (endedCandidate - started) / 1000));
}

function uniqueUsersSince(rows: UsageSessionRow[], sinceMs: number): number {
  const ids = new Set<string>();
  for (const row of rows) {
    const lastMs = Date.parse(row.last_activity_at);
    if (!Number.isNaN(lastMs) && lastMs >= sinceMs) ids.add(row.user_id);
  }
  return ids.size;
}

export async function GET(request: Request) {
  const authCheck = await requireAdmin(request);
  if (authCheck.error) {
    const status = authCheck.error === "Server error." ? 500 : 401;
    return NextResponse.json({ error: authCheck.error }, { status });
  }

  try {
    const now = Date.now();
    const ninetyDaysAgoIso = new Date(now - 90 * DAY_MS).toISOString();
    const thirtyDaysAgoMs = now - 30 * DAY_MS;
    const sevenDaysAgoMs = now - 7 * DAY_MS;
    const oneDayAgoMs = now - DAY_MS;

    const { data, error } = await supabaseAdmin
      .from("app_usage_sessions")
      .select(
        "user_id, role, started_at, last_activity_at, ended_at, page_views, heartbeat_count"
      )
      .gte("last_activity_at", ninetyDaysAgoIso)
      .order("last_activity_at", { ascending: false })
      .limit(20000);

    if (error) {
      return NextResponse.json({ error: "Unable to load usage analytics." }, { status: 500 });
    }

    const rows = (data ?? []) as UsageSessionRow[];

    const last30Rows = rows.filter((row) => {
      const ms = Date.parse(row.last_activity_at);
      return !Number.isNaN(ms) && ms >= thirtyDaysAgoMs;
    });
    const last7Rows = rows.filter((row) => {
      const ms = Date.parse(row.last_activity_at);
      return !Number.isNaN(ms) && ms >= sevenDaysAgoMs;
    });
    const last1Rows = rows.filter((row) => {
      const ms = Date.parse(row.last_activity_at);
      return !Number.isNaN(ms) && ms >= oneDayAgoMs;
    });

    const durations = last30Rows.map(sessionDurationSeconds).filter((s) => s > 0);
    const avgSessionDurationSeconds =
      durations.length > 0
        ? Math.round(durations.reduce((acc, value) => acc + value, 0) / durations.length)
        : 0;

    const totalPageViews30d = last30Rows.reduce(
      (acc, row) => acc + Math.max(0, row.page_views ?? 0),
      0
    );

    const roleActiveUsers30d = new Map<string, Set<string>>();
    for (const row of last30Rows) {
      const role = row.role?.trim() || "unknown";
      const set = roleActiveUsers30d.get(role) ?? new Set<string>();
      set.add(row.user_id);
      roleActiveUsers30d.set(role, set);
    }

    const series: Array<{
      date: string;
      activeUsers: number;
      sessions: number;
      avgSessionDurationSeconds: number;
    }> = [];

    for (let i = 29; i >= 0; i -= 1) {
      const dayStart = new Date(now - i * DAY_MS);
      dayStart.setHours(0, 0, 0, 0);
      const dayEndMs = dayStart.getTime() + DAY_MS;
      const dayStartMs = dayStart.getTime();
      const dayRows = rows.filter((row) => {
        const ms = Date.parse(row.last_activity_at);
        return !Number.isNaN(ms) && ms >= dayStartMs && ms < dayEndMs;
      });
      const dayUsers = new Set(dayRows.map((row) => row.user_id)).size;
      const dayDurations = dayRows.map(sessionDurationSeconds).filter((s) => s > 0);
      const dayAvg =
        dayDurations.length > 0
          ? Math.round(dayDurations.reduce((acc, value) => acc + value, 0) / dayDurations.length)
          : 0;
      series.push({
        date: dayStart.toISOString().slice(0, 10),
        activeUsers: dayUsers,
        sessions: dayRows.length,
        avgSessionDurationSeconds: dayAvg,
      });
    }

    return NextResponse.json({
      dau: uniqueUsersSince(rows, oneDayAgoMs),
      wau: uniqueUsersSince(rows, sevenDaysAgoMs),
      mau: uniqueUsersSince(rows, thirtyDaysAgoMs),
      sessions: {
        last24h: last1Rows.length,
        last7d: last7Rows.length,
        last30d: last30Rows.length,
      },
      avgSessionDurationSeconds,
      totalPageViews30d,
      roleActiveUsers30d: Array.from(roleActiveUsers30d.entries()).map(([role, users]) => ({
        role,
        activeUsers: users.size,
      })),
      dailySeries30d: series,
    });
  } catch (error) {
    console.error("admin/usage/overview GET error:", error);
    return NextResponse.json({ error: "Unable to load usage analytics." }, { status: 500 });
  }
}
