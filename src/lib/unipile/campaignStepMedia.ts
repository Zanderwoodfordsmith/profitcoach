import {
  downloadMessagingAttachments,
  signMessagingAttachments,
  uploadMessagingAttachment,
  validateMessagingAttachment,
  type MessagingAttachmentKind,
  type MessagingAttachmentMeta,
} from "@/lib/messaging/messageAttachments";
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

export async function uploadCampaignStepMedia(input: {
  coachId: string;
  campaignId: string;
  blob: Blob;
  filename: string;
  mime: string;
  kind: MessagingAttachmentKind;
}): Promise<MessagingAttachmentMeta> {
  const err = validateMessagingAttachment({
    mime: input.mime,
    size: input.blob.size,
    filename: input.filename,
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
  return uploadMessagingAttachment({
    coachId: input.coachId,
    conversationId: campaignStepMediaFolder(input.coachId, input.campaignId),
    blob: input.blob,
    filename: input.filename,
    mime: input.mime,
    kind: input.kind,
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
