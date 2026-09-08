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
