import {
  parseStoredCommunityPostMedia,
  type CommunityPostMediaItem,
} from "@/lib/communityPostMedia";

export function parseSupportTicketMedia(raw: unknown): CommunityPostMediaItem[] {
  return parseStoredCommunityPostMedia(raw) ?? [];
}

/** Replies may include images, video, and voice notes. */
export function parseSupportReplyMedia(raw: unknown): CommunityPostMediaItem[] {
  return parseStoredCommunityPostMedia(raw) ?? [];
}

/** Body stored on the reply when the composer has media but no typed text. */
export function supportComposerFallbackBody(input: {
  text: string;
  voice?: boolean;
  video?: boolean;
  imageCount?: number;
}): string {
  const text = input.text.trim();
  if (text) return text;
  if (input.voice) return "Sent a voice note";
  if (input.video) return "Sent a video";
  const images = input.imageCount ?? 0;
  if (images === 1) return "Sent an image";
  if (images > 1) return "Sent images";
  return "";
}

/** Extra lines so an emailed reply still makes sense when files are attached. */
export function supportReplyBodyForEmail(
  body: string,
  media: CommunityPostMediaItem[] = []
): string {
  const trimmed = body.trim();
  const imageCount = media.filter((item) => item.kind === "image").length;
  const hasAudio = media.some((item) => item.kind === "audio");
  const hasVideo = media.some((item) => item.kind === "video");
  const notes: string[] = [];
  if (imageCount === 1) notes.push("Image attached.");
  if (imageCount > 1) notes.push("Images attached.");
  if (hasAudio) notes.push("Voice note attached.");
  if (hasVideo) notes.push("Video attached.");

  if (!trimmed) return notes.join(" ");
  if (notes.length === 0) return trimmed;

  const extra = notes.filter((note) => {
    if (note.startsWith("Voice") && /voice note/i.test(trimmed)) return false;
    if (note.startsWith("Image") && /image attached|sent an image/i.test(trimmed)) {
      return false;
    }
    if (note.startsWith("Video") && /video attached|sent a video/i.test(trimmed)) {
      return false;
    }
    return true;
  });
  if (extra.length === 0) return trimmed;
  return `${trimmed}\n\n${extra.join(" ")}`;
}

export function supportEmailAttachmentFilename(
  item: CommunityPostMediaItem,
  index: number
): string {
  const path = (item.url.split("?")[0] || "").split("/").pop() || "";
  if (path && /\.[a-z0-9]{2,8}$/i.test(path)) return path.slice(0, 120);
  if (item.kind === "audio") return `voice-note-${index + 1}.webm`;
  if (item.kind === "video") return `video-${index + 1}.mp4`;
  return `image-${index + 1}.jpg`;
}
