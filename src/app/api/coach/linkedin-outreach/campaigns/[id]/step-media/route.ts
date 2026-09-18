import { NextResponse } from "next/server";
import { requireOutreachCoach } from "@/lib/unipile/requireOutreachCoach";
import { campaignOwnedByCoach } from "@/lib/unipile/campaigns";
import {
  isOwnedCampaignStepMediaPath,
  signCampaignStepMedia,
  uploadCampaignStepMedia,
} from "@/lib/unipile/campaignStepMedia";
import { filesFromFormData } from "@/lib/messaging/messageAttachments";
import type { CampaignStepMediaKind } from "@/lib/unipile/campaignStepTypes";

export const runtime = "nodejs";

function asKind(raw: unknown): CampaignStepMediaKind | null {
  return raw === "voice" || raw === "video" ? raw : null;
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireOutreachCoach(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const { id: campaignId } = await ctx.params;
  const owned = await campaignOwnedByCoach(auth.coachId, campaignId);
  if (!owned) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }

  const kind = asKind(form.get("kind"));
  if (!kind) {
    return NextResponse.json(
      { error: "Choose voice or video." },
      { status: 400 }
    );
  }
  const files = await filesFromFormData(form, "file");
  const file = files[0];
  if (!file) {
    return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
  }

  try {
    const uploaded = await uploadCampaignStepMedia({
      coachId: auth.coachId,
      campaignId,
      blob: file.blob,
      filename: file.filename,
      mime: file.mime,
      kind,
    });
    const signed = await signCampaignStepMedia({
      kind,
      path: uploaded.path,
      mime: uploaded.mime,
      filename: uploaded.filename,
      size: uploaded.size,
    });
    return NextResponse.json({ media: signed });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireOutreachCoach(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const { id: campaignId } = await ctx.params;
  const owned = await campaignOwnedByCoach(auth.coachId, campaignId);
  if (!owned) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const path = new URL(request.url).searchParams.get("path") ?? "";
  if (!isOwnedCampaignStepMediaPath(auth.coachId, campaignId, path)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const kind = asKind(new URL(request.url).searchParams.get("kind")) ?? "voice";
  const signed = await signCampaignStepMedia({
    kind,
    path,
    mime: "application/octet-stream",
    filename: path.split("/").pop() || "file",
    size: 0,
  });
  return NextResponse.json({ media: signed });
}
