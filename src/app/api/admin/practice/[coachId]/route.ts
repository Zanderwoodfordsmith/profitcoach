import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/requireAdmin";
import {
  ADMIN_ONLY_STATUSES,
  COACH_WRITABLE_STATUSES,
  sanitizePayloadPatch,
  sanitizeStatus,
} from "@/lib/practiceKnowledge/sanitize";
import {
  ensurePracticeKnowledge,
  getLatestIntakeSession,
  getLatestDecisionRecord,
  listIntakeAssets,
  patchPracticeKnowledge,
  syncPracticeToBrain,
} from "@/lib/practiceKnowledge/store";
import { PRACTICE_ASSET_BUCKET } from "@/lib/practiceKnowledge/assets";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function resolveCoachId(raw: string): Promise<string | null> {
  const id = raw.trim();
  if (/^[0-9a-f-]{36}$/i.test(id)) return id;
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("slug", id)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

export async function GET(
  request: Request,
  ctx: { params: Promise<{ coachId: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const { coachId: raw } = await ctx.params;
  const coachId = await resolveCoachId(raw);
  if (!coachId) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  try {
    const [knowledge, session, decision, assets, profile] = await Promise.all([
      ensurePracticeKnowledge(coachId),
      getLatestIntakeSession(coachId),
      getLatestDecisionRecord(coachId),
      listIntakeAssets(coachId),
      supabaseAdmin
        .from("profiles")
        .select("id, full_name, slug, avatar_url, coach_business_name, linkedin_url")
        .eq("id", coachId)
        .maybeSingle(),
    ]);

    const assetsWithUrls = await Promise.all(
      assets.map(async (asset) => {
        const { data } = await supabaseAdmin.storage
          .from(PRACTICE_ASSET_BUCKET)
          .createSignedUrl(asset.storage_path, 60 * 10);
        return { ...asset, signed_url: data?.signedUrl ?? null };
      })
    );

    return NextResponse.json({
      knowledge,
      session,
      decision,
      assets: assetsWithUrls,
      profile: profile.data,
    });
  } catch (err) {
    console.error("admin practice GET:", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Could not load this coach." }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ coachId: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const { coachId: raw } = await ctx.params;
  const coachId = await resolveCoachId(raw);
  if (!coachId) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const status = sanitizeStatus(body.status);
  const allowed = [...COACH_WRITABLE_STATUSES, ...ADMIN_ONLY_STATUSES];
  if (status && !allowed.includes(status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  try {
    const knowledge = await patchPracticeKnowledge({
      coachId,
      payloadPatch: sanitizePayloadPatch(body.payload, "admin"),
      status: status ?? undefined,
      adminReviewed: body.admin_reviewed === true || status === "admin_reviewed",
    });
    if (body.sync_brain === true || status === "ready_to_build") {
      await syncPracticeToBrain(coachId);
    }
    return NextResponse.json({ knowledge });
  } catch (err) {
    console.error("admin practice PATCH:", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Could not update practice knowledge." }, { status: 500 });
  }
}
