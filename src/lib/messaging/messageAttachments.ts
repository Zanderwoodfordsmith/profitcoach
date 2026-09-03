import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const MESSAGING_ATTACHMENTS_BUCKET = "messaging-attachments";

export const MAX_MESSAGING_ATTACHMENT_BYTES = 15 * 1024 * 1024;
export const MAX_MESSAGING_ATTACHMENTS = 5;

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "audio/mp4",
  "audio/m4a",
  "audio/mpeg",
  "audio/webm",
  "audio/ogg",
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "pptx",
  "text/plain": "txt",
  "audio/mp4": "m4a",
  "audio/m4a": "m4a",
  "audio/mpeg": "mp3",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

export type MessagingAttachmentKind = "file" | "voice" | "video";

export type MessagingAttachmentMeta = {
  path: string;
  mime: string;
  size: number;
  filename: string;
  kind?: MessagingAttachmentKind;
  signedUrl?: string | null;
};

/** Strip codec/params so `audio/webm;codecs=opus` matches `audio/webm`. */
export function normalizeMessagingMime(mime: string): string {
  return (mime || "").split(";")[0]!.trim().toLowerCase();
}

export function isAllowedMessagingAttachmentMime(mime: string): boolean {
  return ALLOWED_MIME.has(normalizeMessagingMime(mime));
}

export function isImageMessagingAttachmentMime(mime: string): boolean {
  return normalizeMessagingMime(mime).startsWith("image/");
}

function extForMime(mime: string, filename?: string): string {
  const lower = normalizeMessagingMime(mime);
  if (EXT_BY_MIME[lower]) return EXT_BY_MIME[lower]!;
  const fromName = filename?.split(".").pop()?.toLowerCase();
  if (fromName && fromName.length <= 5) return fromName;
  return "bin";
}

export function validateMessagingAttachment(file: {
  mime: string;
  size: number;
  filename?: string;
}): string | null {
  const mime = normalizeMessagingMime(file.mime);
  if (!isAllowedMessagingAttachmentMime(mime)) {
    return `Unsupported file type${file.filename ? ` (${file.filename})` : ""}.`;
  }
  if (file.size <= 0 || file.size > MAX_MESSAGING_ATTACHMENT_BYTES) {
    return `Each file must be under ${Math.round(MAX_MESSAGING_ATTACHMENT_BYTES / (1024 * 1024))}MB.`;
  }
  return null;
}

export async function uploadMessagingAttachment(input: {
  coachId: string;
  conversationId: string;
  blob: Blob;
  filename: string;
  mime: string;
  kind?: MessagingAttachmentKind;
}): Promise<MessagingAttachmentMeta> {
  const mime =
    normalizeMessagingMime(input.mime) || "application/octet-stream";
  const size = input.blob.size;
  const err = validateMessagingAttachment({
    mime,
    size,
    filename: input.filename,
  });
  if (err) throw new Error(err);

  const safeName = (input.filename || "file")
    .replace(/[^\w.\-]+/g, "_")
    .slice(0, 80);
  const ext = extForMime(mime, safeName);
  const path = `${input.coachId}/${input.conversationId}/${randomUUID()}.${ext}`;

  const { error } = await supabaseAdmin.storage
    .from(MESSAGING_ATTACHMENTS_BUCKET)
    .upload(path, input.blob, {
      contentType: mime,
      upsert: false,
    });
  if (error) {
    throw new Error(error.message || "Could not upload attachment.");
  }

  const kind =
    input.kind ||
    (mime.startsWith("audio/")
      ? "voice"
      : mime.startsWith("video/")
        ? "video"
        : "file");

  return {
    path,
    mime,
    size,
    filename: safeName.includes(".") ? safeName : `${safeName}.${ext}`,
    kind,
  };
}

export async function downloadMessagingAttachments(
  items: MessagingAttachmentMeta[]
): Promise<Array<{ blob: Blob; filename: string }>> {
  const out: Array<{ blob: Blob; filename: string }> = [];
  for (const item of items) {
    const { data, error } = await supabaseAdmin.storage
      .from(MESSAGING_ATTACHMENTS_BUCKET)
      .download(item.path);
    if (error || !data) {
      throw new Error(
        `Could not load attachment: ${error?.message ?? item.path}`
      );
    }
    out.push({
      blob: new Blob([await data.arrayBuffer()], {
        type: item.mime || "application/octet-stream",
      }),
      filename: item.filename || item.path.split("/").pop() || "attachment",
    });
  }
  return out;
}

export function parseMessagingAttachments(
  raw: unknown
): MessagingAttachmentMeta[] {
  if (!Array.isArray(raw)) return [];
  const out: MessagingAttachmentMeta[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const path = typeof r.path === "string" ? r.path : "";
    if (!path) continue;
    const kindRaw = typeof r.kind === "string" ? r.kind : "";
    const kind: MessagingAttachmentKind | undefined =
      kindRaw === "voice" || kindRaw === "video" || kindRaw === "file"
        ? kindRaw
        : undefined;
    out.push({
      path,
      mime: typeof r.mime === "string" ? r.mime : "application/octet-stream",
      size: typeof r.size === "number" ? r.size : 0,
      filename:
        typeof r.filename === "string"
          ? r.filename
          : path.split("/").pop() || "file",
      kind,
    });
  }
  return out;
}

export async function signMessagingAttachments(
  items: MessagingAttachmentMeta[],
  expiresIn = 3600
): Promise<MessagingAttachmentMeta[]> {
  const out: MessagingAttachmentMeta[] = [];
  for (const item of items) {
    const { data } = await supabaseAdmin.storage
      .from(MESSAGING_ATTACHMENTS_BUCKET)
      .createSignedUrl(item.path, expiresIn);
    out.push({ ...item, signedUrl: data?.signedUrl ?? null });
  }
  return out;
}

export async function filesFromFormData(
  form: FormData,
  fieldName = "attachments"
): Promise<Array<{ blob: Blob; filename: string; mime: string }>> {
  const entries = form.getAll(fieldName);
  const out: Array<{ blob: Blob; filename: string; mime: string }> = [];
  for (const entry of entries) {
    if (typeof entry === "string") continue;
    // FormDataFile in runtime is File; duck-type for Edge/Node compatibility.
    const file = entry as Blob & { name?: string; type?: string };
    if (typeof file.arrayBuffer !== "function" || typeof file.size !== "number") {
      continue;
    }
    const filename =
      typeof file.name === "string" && file.name
        ? file.name
        : `attachment-${out.length + 1}`;
    const mime = file.type || "application/octet-stream";
    out.push({ blob: file, filename, mime });
  }
  return out;
}
