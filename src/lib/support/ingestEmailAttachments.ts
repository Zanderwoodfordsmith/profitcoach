import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  COMMUNITY_POST_MEDIA_MAX,
  COMMUNITY_POST_MAX_AUDIO_BYTES,
  COMMUNITY_POST_MAX_IMAGE_BYTES,
  EXT_BY_MIME,
  mediaKindForMime,
  resolveMediaMimeFromName,
  type CommunityPostMediaItem,
  type CommunityPostMediaKind,
} from "@/lib/communityPostMedia";
import {
  downloadUnipileEmailAttachment,
  getUnipileEmail,
  type UnipileEmailAttachment,
} from "@/lib/unipile/client";

/** Keep webhook ingest snappy — in-app support still allows larger videos. */
const EMAIL_MAX_VIDEO_BYTES = 12 * 1024 * 1024;

export type SupportEmailAttachmentMeta = {
  id: string;
  name: string;
  mime: string | null;
  size: number | null;
  inline: boolean;
};

export function parseUnipileEmailAttachmentMeta(
  raw: unknown
): SupportEmailAttachmentMeta[] {
  if (!Array.isArray(raw)) return [];
  const out: SupportEmailAttachmentMeta[] = [];
  for (const el of raw) {
    if (!el || typeof el !== "object") continue;
    const row = el as UnipileEmailAttachment;
    const id = typeof row.id === "string" ? row.id.trim() : "";
    if (!id) continue;
    const name =
      (typeof row.name === "string" && row.name.trim()) || "attachment";
    const mime =
      typeof row.mime === "string" && row.mime.trim()
        ? row.mime.split(";")[0]!.trim().toLowerCase()
        : null;
    const size =
      typeof row.size === "number" && Number.isFinite(row.size)
        ? row.size
        : null;
    const inline = Boolean(row.inline) || Boolean(row.cid);
    out.push({ id, name, mime, size, inline });
  }
  return out;
}

export function isInlineEmailAttachment(
  attachment: Pick<SupportEmailAttachmentMeta, "inline">
): boolean {
  return attachment.inline;
}

function maxBytesForEmailAttachment(kind: CommunityPostMediaKind): number {
  if (kind === "video") return EMAIL_MAX_VIDEO_BYTES;
  if (kind === "audio") return COMMUNITY_POST_MAX_AUDIO_BYTES;
  return COMMUNITY_POST_MAX_IMAGE_BYTES;
}

export function classifySupportEmailAttachment(
  attachment: SupportEmailAttachmentMeta
):
  | { ingest: true; mime: string; kind: CommunityPostMediaKind }
  | { ingest: false; reason: "inline" | "unsupported" | "too_large" } {
  if (isInlineEmailAttachment(attachment)) {
    return { ingest: false, reason: "inline" };
  }
  const mime = resolveMediaMimeFromName(attachment.name, attachment.mime);
  if (!mime) return { ingest: false, reason: "unsupported" };
  const kind = mediaKindForMime(mime);
  if (!kind) return { ingest: false, reason: "unsupported" };
  const maxBytes = maxBytesForEmailAttachment(kind);
  if (attachment.size != null && attachment.size > maxBytes) {
    return { ingest: false, reason: "too_large" };
  }
  return { ingest: true, mime, kind };
}

export function formatSkippedEmailAttachmentNote(names: string[]): string {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (unique.length === 0) return "";
  return `\n\nAlso attached (not shown here): ${unique.join(", ")}`;
}

function storageFolderFromEmailId(emailId: string): string {
  const safe = emailId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
  return safe || "mail";
}

async function uploadSupportEmailMedia(input: {
  emailId: string;
  bytes: Uint8Array;
  mime: string;
  kind: CommunityPostMediaKind;
}): Promise<CommunityPostMediaItem | null> {
  const ext = EXT_BY_MIME[input.mime] ?? (input.kind === "video" ? "mp4" : "jpg");
  const path = `support-mail/${storageFolderFromEmailId(input.emailId)}/${randomUUID()}.${ext}`;
  const { error } = await supabaseAdmin.storage
    .from("community-posts")
    .upload(path, input.bytes, {
      contentType: input.mime,
      upsert: false,
    });
  if (error) {
    console.warn("support mail attachment upload:", error.message);
    return null;
  }
  const { data } = supabaseAdmin.storage.from("community-posts").getPublicUrl(path);
  const url = data.publicUrl?.trim();
  if (!url) return null;
  return { url, kind: input.kind };
}

export type IngestedSupportEmailAttachments = {
  media: CommunityPostMediaItem[];
  skippedNames: string[];
};

/**
 * Download real attachments from a support mailbox email (skip signature images).
 * Images / video / audio land on the ticket; other files are named in skippedNames.
 */
export async function ingestSupportEmailAttachments(input: {
  emailId: string;
  accountId: string;
  webhookBody?: Record<string, unknown>;
}): Promise<IngestedSupportEmailAttachments> {
  let metas = parseUnipileEmailAttachmentMeta(input.webhookBody?.attachments);
  if (metas.length === 0) {
    const maybeHasFiles =
      input.webhookBody?.has_attachments === true ||
      Number(input.webhookBody?.attachments_count) > 0 ||
      input.webhookBody?.attachments == null;
    if (maybeHasFiles) {
      const email = await getUnipileEmail(input.emailId, input.accountId);
      metas = parseUnipileEmailAttachmentMeta(email.data?.attachments);
    }
  }

  const media: CommunityPostMediaItem[] = [];
  const skippedNames: string[] = [];

  for (const attachment of metas) {
    if (media.length >= COMMUNITY_POST_MEDIA_MAX) {
      if (!isInlineEmailAttachment(attachment)) {
        skippedNames.push(attachment.name);
      }
      continue;
    }
    const classified = classifySupportEmailAttachment(attachment);
    if (!classified.ingest) {
      if (classified.reason !== "inline") {
        skippedNames.push(attachment.name);
      }
      continue;
    }

    const downloaded = await downloadUnipileEmailAttachment({
      emailId: input.emailId,
      attachmentId: attachment.id,
      accountId: input.accountId,
      maxBytes: maxBytesForEmailAttachment(classified.kind),
    });
    if (!downloaded.ok || !downloaded.data?.bytes.length) {
      skippedNames.push(attachment.name);
      continue;
    }
    if (downloaded.data.bytes.byteLength > maxBytesForEmailAttachment(classified.kind)) {
      skippedNames.push(attachment.name);
      continue;
    }

    const item = await uploadSupportEmailMedia({
      emailId: input.emailId,
      bytes: downloaded.data.bytes,
      mime: classified.mime,
      kind: classified.kind,
    });
    if (!item) {
      skippedNames.push(attachment.name);
      continue;
    }
    media.push(item);
  }

  return { media, skippedNames };
}
