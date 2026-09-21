import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { filesFromFormData } from "@/lib/messaging/messageAttachments";
import {
  signCampaignStepMedia,
  uploadCampaignStepMedia,
} from "@/lib/unipile/campaignStepMedia";
import type { CampaignStepMediaKind } from "@/lib/unipile/campaignStepTypes";
import {
  getLibraryItem,
  isOwnedLibraryStepMediaPath,
  LIBRARY_MEDIA_COACH_ID,
  libraryStepMediaFolder,
} from "@/lib/campaignLibrary/store";

export const runtime = "nodejs";
export const maxDuration = 60;

function asKind(raw: unknown): CampaignStepMediaKind | null {
  return raw === "voice" || raw === "video" ? raw : null;
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const { id } = await ctx.params;
  const item = await getLibraryItem(id);
  if (!item) return NextResponse.json({ error: "Not found." }, { status: 404 });

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
      coachId: LIBRARY_MEDIA_COACH_ID,
      campaignId: libraryStepMediaFolder(id),
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
  const auth = await requireAdmin(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const { id } = await ctx.params;
  const item = await getLibraryItem(id);
  if (!item) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const path = new URL(request.url).searchParams.get("path") ?? "";
  if (!isOwnedLibraryStepMediaPath(id, path)) {
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
