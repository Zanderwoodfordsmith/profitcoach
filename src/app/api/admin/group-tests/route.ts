import { NextResponse } from "next/server";
import { verdict, type GroupTestArm, type GroupTestSlot } from "@/lib/groupTests/core";
import { groupTestResults, listGroupTests, saveGroupTest, setGroupTestStatus } from "@/lib/groupTests/store";
import { requireAdmin } from "@/lib/requireAdmin";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Admin: every group test with pooled results so far. */
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });
  const tests = await listGroupTests();
  const withResults = await Promise.all(
    tests.map(async (t) => {
      if (t.status === "draft") return { ...t, results: null };
      const results = await groupTestResults(t.id);
      const metric = t.step_type === "invite" ? "accepted" : "interested";
      return { ...t, results: { ...results, verdict: verdict(results.arms, metric, t.target_per_arm), metric } };
    })
  );
  return NextResponse.json({ tests: withResults });
}

/** Create or edit a draft test. */
export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error || !auth.userId) return NextResponse.json({ error: auth.error }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const id = await saveGroupTest({
      id: typeof body.id === "string" ? body.id : null,
      name: typeof body.name === "string" ? body.name : "",
      hypothesis: typeof body.hypothesis === "string" ? body.hypothesis : null,
      step_type: body.step_type === "invite" ? "invite" : "message",
      arms: Array.isArray(body.arms) ? (body.arms as GroupTestArm[]).filter((a) => a && typeof a.body === "string") : [],
      slots: Array.isArray(body.slots) ? (body.slots as GroupTestSlot[]).filter((s) => s && typeof s.key === "string" && typeof s.label === "string") : [],
      target_per_arm: typeof body.target_per_arm === "number" ? body.target_per_arm : undefined,
      createdBy: auth.userId,
    });
    return NextResponse.json({ id });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not save." }, { status: 400 });
  }
}

/** Body: { id, status: "live" | "ended" }. */
export async function PATCH(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = typeof body.id === "string" ? body.id : "";
  if (!/^[0-9a-f-]{36}$/i.test(id) || (body.status !== "live" && body.status !== "ended")) {
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  }
  await setGroupTestStatus(id, body.status);
  return NextResponse.json({ ok: true });
}
