import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function rollingMonthKeysIncludingCurrent(count: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(monthKey(dt));
  }
  return keys;
}

type CoachRow = {
  id: string;
  slug: string;
  full_name: string | null;
  coach_business_name: string | null;
};

export async function GET(request: Request) {
  const check = await requireAdmin(request);
  if (check.error) {
    const status = check.error === "Server error." ? 500 : 401;
    return NextResponse.json({ error: check.error }, { status });
  }

  try {
    const { data: coachesData, error: coachesError } = await supabaseAdmin
      .from("coaches")
      .select("id, slug, profiles!inner(full_name, coach_business_name)")
      .order("slug", { ascending: true });

    if (coachesError) {
      return NextResponse.json({ error: "Unable to load coaches." }, { status: 500 });
    }

    const coaches: CoachRow[] =
      coachesData?.map((row: any) => ({
        id: row.id as string,
        slug: row.slug as string,
        full_name: row.profiles?.full_name ?? null,
        coach_business_name: row.profiles?.coach_business_name ?? null,
      })) ?? [];

    if (coaches.length === 0) {
      return NextResponse.json({ coaches: [] });
    }

    const coachIds = coaches.map((c) => c.id);

    const windowStart = new Date();
    windowStart.setFullYear(windowStart.getFullYear() - 5);
    const fromStr = windowStart.toISOString().slice(0, 10);

    const [{ data: lines, error: linesError }, { data: contacts, error: contactsError }] =
      await Promise.all([
        supabaseAdmin
          .from("coach_revenue_lines")
          .select("coach_id, occurred_on, amount")
          .in("coach_id", coachIds)
          .gte("occurred_on", fromStr),
        supabaseAdmin
          .from("contacts")
          .select("coach_id")
          .eq("type", "client")
          .in("coach_id", coachIds),
      ]);

    if (linesError || contactsError) {
      console.error("coach-revenue-summary:", linesError ?? contactsError);
      return NextResponse.json({ error: "Unable to load revenue data." }, { status: 500 });
    }

    const clientCountByCoach = new Map<string, number>();
    for (const row of contacts ?? []) {
      const cid = (row as { coach_id: string }).coach_id;
      if (!cid) continue;
      clientCountByCoach.set(cid, (clientCountByCoach.get(cid) ?? 0) + 1);
    }

    const last3Keys = rollingMonthKeysIncludingCurrent(3);
    const last3Set = new Set(last3Keys);
    const now = new Date();
    const currentMonthKey = monthKey(now);
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthKey = monthKey(prevMonthDate);

    const byCoach = new Map<
      string,
      {
        lastOn: string | null;
        sumThisMonth: number;
        sumPreviousMonth: number;
        sumLast3: number;
      }
    >();

    for (const id of coachIds) {
      byCoach.set(id, {
        lastOn: null,
        sumThisMonth: 0,
        sumPreviousMonth: 0,
        sumLast3: 0,
      });
    }

    for (const row of lines ?? []) {
      const r = row as { coach_id: string; occurred_on: string; amount: string | number };
      const amt = typeof r.amount === "string" ? Number.parseFloat(r.amount) : r.amount;
      if (!Number.isFinite(amt)) continue;
      const agg = byCoach.get(r.coach_id);
      if (!agg) continue;
      const on = r.occurred_on;
      if (!agg.lastOn || on > agg.lastOn) agg.lastOn = on;
      const mk = on.slice(0, 7);
      if (mk === currentMonthKey) {
        agg.sumThisMonth += amt;
      }
      if (mk === previousMonthKey) {
        agg.sumPreviousMonth += amt;
      }
      if (last3Set.has(mk)) {
        agg.sumLast3 += amt;
      }
    }

    const staleCutoff = new Date();
    staleCutoff.setDate(staleCutoff.getDate() - 60);
    const staleCutStr = staleCutoff.toISOString().slice(0, 10);

    const payload = coaches.map((c) => {
      const agg = byCoach.get(c.id)!;
      const stale =
        !agg.lastOn || agg.lastOn < staleCutStr ? true : false;
      return {
        coachId: c.id,
        slug: c.slug,
        full_name: c.full_name,
        coach_business_name: c.coach_business_name,
        client_count: clientCountByCoach.get(c.id) ?? 0,
        last_occurred_on: agg.lastOn,
        sum_this_calendar_month: Math.round(agg.sumThisMonth * 100) / 100,
        sum_previous_calendar_month: Math.round(agg.sumPreviousMonth * 100) / 100,
        sum_last_3_calendar_months: Math.round(agg.sumLast3 * 100) / 100,
        stale_no_revenue_60d: stale,
      };
    });

    return NextResponse.json({ coaches: payload });
  } catch (e) {
    console.error("admin/coach-revenue-summary:", e);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
