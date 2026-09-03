import {
  parseStoredCommunityPostMedia,
  type CommunityPostMediaItem,
} from "@/lib/communityPostMedia";
import {
  parseStoredCommunityCommentMedia,
  type CommunityCommentMediaItem,
} from "@/lib/communityCommentMedia";

export function parseSupportTicketMedia(raw: unknown): CommunityPostMediaItem[] {
  return parseStoredCommunityPostMedia(raw) ?? [];
}

export function parseSupportReplyMedia(raw: unknown): CommunityCommentMediaItem[] {
  return parseStoredCommunityCommentMedia(raw);
}
