import { NextResponse } from "next/server";
import { requireOutreachCoach } from "@/lib/unipile/requireOutreachCoach";
import { campaignOwnedByCoach } from "@/lib/unipile/campaigns";
import {
  createCampaignStepMediaUploadSlot,
  finishCampaignStepMediaUpload,
  isOwnedCampaignStepMediaPath,
  signCampaignStepMedia,
  uploadCampaignStepMedia,
} from "@/lib/unipile/campaignStepMedia";
import { filesFromFormData } from "@/lib/messaging/messageAttachments";
import type { CampaignStepMediaKind } from "@/lib/unipile/campaignStepTypes";

export const runtime = "nodejs";
export const maxDuration = 60;

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

  if (request.headers.get("content-type")?.includes("application/json")) {
    return directUpload(request, auth.coachId, campaignId);
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

/** { intent: "start" } → upload slot; { intent: "complete", path } → media. */
async function directUpload(request: Request, coachId: string, campaignId: string) {
  const body = (await request.json().catch(() => null)) as {
    intent?: string;
    kind?: unknown;
    filename?: string;
    mime?: string;
    size?: number;
    path?: string;
  } | null;
  const kind = asKind(body?.kind);
  if (!body || !kind) {
    return NextResponse.json({ error: "Choose voice or video." }, { status: 400 });
  }
  const filename = body.filename || "file";
  const mime = body.mime || "";
  try {
    if (body.intent === "start") {
      const slot = await createCampaignStepMediaUploadSlot({
        ownerId: coachId,
        campaignId,
        filename,
        mime,
        size: Number(body.size ?? 0),
        kind,
      });
      return NextResponse.json(slot);
    }
    if (body.intent === "complete") {
      const media = await finishCampaignStepMediaUpload({
        ownerId: coachId,
        campaignId,
        path: body.path ?? "",
        filename,
        mime,
        kind,
      });
      return NextResponse.json({ media });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  return NextResponse.json({ error: "Bad request." }, { status: 400 });
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
