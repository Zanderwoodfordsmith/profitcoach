import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  downloadMessagingAttachments,
  extForMime,
  MESSAGING_ATTACHMENTS_BUCKET,
  normalizeMessagingMime,
  signMessagingAttachments,
  uploadMessagingAttachment,
  validateMessagingAttachment,
  type MessagingAttachmentKind,
  type MessagingAttachmentMeta,
} from "@/lib/messaging/messageAttachments";
import { MAX_CAMPAIGN_STEP_MEDIA_BYTES } from "@/lib/unipile/campaignStepMediaLimits";
import type { CampaignStepMedia } from "@/lib/unipile/campaignStepTypes";
import { messageMediaFrom } from "@/lib/unipile/campaignStepTypes";

export function campaignStepMediaFolder(
  coachId: string,
  campaignId: string
): string {
  return `campaigns/${campaignId}`;
}

export function isOwnedCampaignStepMediaPath(
  coachId: string,
  campaignId: string,
  path: string
): boolean {
  const prefix = `${coachId}/campaigns/${campaignId}/`;
  return path.startsWith(prefix) && !path.includes("..");
}

function checkCampaignStepMedia(input: {
  mime: string;
  size: number;
  filename: string;
  kind: MessagingAttachmentKind;
}) {
  const err = validateMessagingAttachment({
    mime: input.mime,
    size: input.size,
    filename: input.filename,
    maxBytes: MAX_CAMPAIGN_STEP_MEDIA_BYTES,
  });
  if (err) throw new Error(err);
  if (input.kind !== "voice" && input.kind !== "video") {
    throw new Error("Upload a voice note or video.");
  }
  const mime = input.mime.toLowerCase();
  if (input.kind === "voice" && !mime.startsWith("audio/")) {
    throw new Error("Voice notes need an audio file.");
  }
  if (input.kind === "video" && !mime.startsWith("video/")) {
    throw new Error("Videos need a video file.");
  }
}

/**
 * Step 1 of a direct upload: a one-time slot the browser uploads into, so the
 * file skips our server (Vercel turns away request bodies over 4.5 MB).
 * `ownerId` is the coach id, or the library's id for template campaigns.
 */
export async function createCampaignStepMediaUploadSlot(input: {
  ownerId: string;
  campaignId: string;
  filename: string;
  mime: string;
  size: number;
  kind: MessagingAttachmentKind;
}): Promise<{ path: string; token: string }> {
  checkCampaignStepMedia(input);
  const mime = normalizeMessagingMime(input.mime);
  const path = `${input.ownerId}/${campaignStepMediaFolder(
    input.ownerId,
    input.campaignId
  )}/${randomUUID()}.${extForMime(mime, input.filename)}`;
  const { data, error } = await supabaseAdmin.storage
    .from(MESSAGING_ATTACHMENTS_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) {
    throw new Error(error?.message || "Could not start the upload.");
  }
  return { path: data.path, token: data.token };
}

/** Step 2: check the uploaded file is there and inside this campaign's folder. */
export async function finishCampaignStepMediaUpload(input: {
  ownerId: string;
  campaignId: string;
  path: string;
  filename: string;
  mime: string;
  kind: MessagingAttachmentKind;
}): Promise<CampaignStepMedia & { signedUrl?: string | null }> {
  if (!isOwnedCampaignStepMediaPath(input.ownerId, input.campaignId, input.path)) {
    throw new Error("That file belongs to another campaign.");
  }
  const { data, error } = await supabaseAdmin.storage
    .from(MESSAGING_ATTACHMENTS_BUCKET)
    .info(input.path);
  if (error || !data) throw new Error("The upload didn't arrive. Try again.");
  const size = Number(data.size ?? 0);
  checkCampaignStepMedia({ ...input, size });
  const safeName = (input.filename || "file")
    .replace(/[^\w.\-]+/g, "_")
    .slice(0, 80);
  const signed = await signCampaignStepMedia({
    kind: input.kind as CampaignStepMedia["kind"],
    path: input.path,
    mime: normalizeMessagingMime(input.mime),
    filename: safeName,
    size,
  });
  return signed!;
}

export async function uploadCampaignStepMedia(input: {
  coachId: string;
  campaignId: string;
  blob: Blob;
  filename: string;
  mime: string;
  kind: MessagingAttachmentKind;
}): Promise<MessagingAttachmentMeta> {
  checkCampaignStepMedia({ ...input, size: input.blob.size });
  return uploadMessagingAttachment({
    coachId: input.coachId,
    conversationId: campaignStepMediaFolder(input.coachId, input.campaignId),
    blob: input.blob,
    filename: input.filename,
    mime: input.mime,
    kind: input.kind,
    maxBytes: MAX_CAMPAIGN_STEP_MEDIA_BYTES,
  });
}

export async function signCampaignStepMedia(
  media: CampaignStepMedia | null
): Promise<(CampaignStepMedia & { signedUrl?: string | null }) | null> {
  if (!media) return null;
  const [signed] = await signMessagingAttachments([
    {
      path: media.path,
      mime: media.mime,
      size: media.size,
      filename: media.filename,
      kind: media.kind,
    },
  ]);
  if (!signed) return media;
  return { ...media, signedUrl: signed.signedUrl ?? null };
}

export async function downloadCampaignStepMedia(
  media: CampaignStepMedia
): Promise<{ blob: Blob; filename: string }> {
  const [file] = await downloadMessagingAttachments([
    {
      path: media.path,
      mime: media.mime,
      size: media.size,
      filename: media.filename,
      kind: media.kind,
    },
  ]);
  if (!file) throw new Error("Could not load the voice or video file.");
  return file;
}

export function mediaFromStepConfig(
  config: unknown
): CampaignStepMedia | null {
  return messageMediaFrom(config);
}
