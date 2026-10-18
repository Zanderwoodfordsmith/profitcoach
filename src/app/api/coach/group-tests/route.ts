import { NextResponse } from "next/server";
import { joinGroupTest, leaveGroupTest, listGroupTests } from "@/lib/groupTests/store";
import { requireOutreachCoach } from "@/lib/unipile/requireOutreachCoach";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/** Live tests a coach can join, and whether this campaign is already in one (?campaignId=). */
export async function GET(request: Request) {
  const auth = await requireOutreachCoach(request);
  if (auth.error || !auth.coachId) return NextResponse.json({ error: auth.error ?? "Not authorised." }, { status: 401 });
  const campaignId = new URL(request.url).searchParams.get("campaignId") || "";
  const tests = await listGroupTests({ liveOnly: true });
  let current: { group_test_id: string; fills: Record<string, string> } | null = null;
  if (/^[0-9a-f-]{36}$/i.test(campaignId)) {
    const { data } = await supabaseAdmin
      .from("group_test_enrolments")
      .select("group_test_id, fills")
      .eq("campaign_id", campaignId)
      .eq("coach_id", auth.coachId)
      .is("left_at", null)
      .maybeSingle();
    current = data ? { group_test_id: data.group_test_id as string, fills: (data.fills ?? {}) as Record<string, string> } : null;
  }
  return NextResponse.json({
    tests: tests.map((t) => ({ id: t.id, name: t.name, hypothesis: t.hypothesis, step_type: t.step_type, arms: t.arms, slots: t.slots })),
    current,
  });
}

/** Body: { campaignId, testId, fills }. */
export async function POST(request: Request) {
  const auth = await requireOutreachCoach(request);
  if (auth.error || !auth.coachId) return NextResponse.json({ error: auth.error ?? "Not authorised." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    await joinGroupTest({
      coachId: auth.coachId,
      campaignId: typeof body.campaignId === "string" ? body.campaignId : "",
      testId: typeof body.testId === "string" ? body.testId : "",
      fills: body.fills && typeof body.fills === "object" ? (body.fills as Record<string, unknown>) : {},
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not join." }, { status: 400 });
  }
}

/** Body: { campaignId } — leave the test and keep version A as your own wording. */
export async function DELETE(request: Request) {
  const auth = await requireOutreachCoach(request);
  if (auth.error || !auth.coachId) return NextResponse.json({ error: auth.error ?? "Not authorised." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const campaignId = typeof body.campaignId === "string" ? body.campaignId : "";
  if (!/^[0-9a-f-]{36}$/i.test(campaignId)) return NextResponse.json({ error: "Missing campaign." }, { status: 400 });
  await leaveGroupTest({ coachId: auth.coachId, campaignId });
  return NextResponse.json({ ok: true });
}
