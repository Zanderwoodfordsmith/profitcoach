import { NextResponse } from "next/server";
import { postApprovedNudges, runNudgeScan } from "@/lib/ava/nudges";
import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 300;

const VIEWS = { queued: ["queued"], approved: ["approved", "posted"], rejected: ["rejected", "skipped"] } as const;
type View = keyof typeof VIEWS;

/** Admin queue of Ava nudges: list by status. */
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });

  const raw = new URL(request.url).searchParams.get("view") ?? "queued";
  const view: View = raw in VIEWS ? (raw as View) : "queued";
  const { data: rows, error } = await supabaseAdmin
    .from("ava_nudges")
    .select("id, coach_id, scan_date, level, stuck_at, next_step, body, status, decided_at, posted_at, note")
    .in("status", [...VIEWS[view]])
    .order("scan_date", { ascending: false })
    .order("level", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: "Could not load nudges." }, { status: 500 });

  const ids = [...new Set((rows ?? []).map((r) => r.coach_id as string))];
  const [{ data: profiles }, { data: coaches }, counts] = await Promise.all([
    supabaseAdmin.from("profiles").select("id, full_name").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
    supabaseAdmin.from("coaches").select("id, slug").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
    Promise.all(
      (Object.keys(VIEWS) as View[]).map(async (v) => {
        const { count } = await supabaseAdmin.from("ava_nudges").select("id", { count: "exact", head: true }).in("status", [...VIEWS[v]]);
        return [v, count ?? 0] as const;
      })
    ),
  ]);
  const name = new Map((profiles ?? []).map((p) => [p.id as string, (p.full_name as string) || ""]));
  const slug = new Map((coaches ?? []).map((c) => [c.id as string, (c.slug as string) || ""]));

  return NextResponse.json({
    rows: (rows ?? []).map((r) => ({ ...r, coach_name: name.get(r.coach_id as string) ?? "", coach_slug: slug.get(r.coach_id as string) ?? "" })),
    counts: Object.fromEntries(counts),
  });
}

/** Approve (with any edits) or reject one nudge. */
export async function PATCH(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { id?: string; action?: string; body?: string; note?: string } | null;
  if (!body?.id || (body.action !== "approve" && body.action !== "reject" && body.action !== "save")) {
    return NextResponse.json({ error: "id and action (approve, reject or save) are required." }, { status: 400 });
  }
  const text = body.body?.trim();
  if (body.action !== "reject" && !text) return NextResponse.json({ error: "The nudge is empty." }, { status: 400 });

  const now = new Date().toISOString();
  const update: Record<string, unknown> = { updated_at: now };
  if (text) update.body = text;
  if (body.note !== undefined) update.note = body.note.trim() || null;
  if (body.action !== "save") {
    update.status = body.action === "approve" ? "approved" : "rejected";
    update.decided_at = now;
    update.decided_by = auth.userId;
  }
  const { data, error } = await supabaseAdmin
    .from("ava_nudges")
    .update(update)
    .eq("id", body.id)
    .in("status", body.action === "save" ? ["queued", "approved"] : ["queued"])
    .select("id, status, body")
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Could not save." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "That nudge was already decided." }, { status: 409 });
  if (body.action === "approve") {
    // Goes out now unless a guardrail holds it; the hourly run tries again.
    try {
      const post = await postApprovedNudges(data.id as string);
      if (post.posted) data.status = "posted";
    } catch (err) {
      console.error("nudge post:", err instanceof Error ? err.message : err);
    }
  }
  return NextResponse.json({ ok: true, nudge: data });
}

/** Run today's scan now (it also runs every morning). */
export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, ...(await runNudgeScan()) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Scan failed." }, { status: 500 });
  }
}
