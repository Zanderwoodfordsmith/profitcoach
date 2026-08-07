import type { LinkedInMediaItem, LinkedInPostType } from "@/lib/linkedinPublishing";

export type LinkedInPostStatus =
  | "draft"
  | "scheduled"
  | "published"
  | "failed"
  | "cancelled";

export type LinkedInPostItem = {
  id: string;
  content: string;
  scheduled_for: string | null;
  status: LinkedInPostStatus;
  attempts: number;
  last_error: string | null;
  linkedin_post_urn: string | null;
  published_at: string | null;
  created_at: string;
  post_type: LinkedInPostType;
  category: string | null;
  article_url: string | null;
  article_title?: string | null;
  article_description?: string | null;
  article_thumbnail_url?: string | null;
  media: Array<LinkedInMediaItem & { signedUrl?: string | null }>;
};

export type LinkedInProfilePreview = {
  name: string | null;
  headline: string | null;
  photoUrl: string | null;
  email: string | null;
  tokenExpiry: string | null;
  scopes: string[];
  websiteLabel: string;
  websiteUrl: string | null;
  quoteHandle: string;
};

export const LI_BLUE = "#0A66C2";

/** sessionStorage key for handing a promo draft into Content planner → Compose. */
export const LINKEDIN_COMPOSE_SEED_KEY = "linkedin-compose-seed";

export function displayName(profile: LinkedInProfilePreview): string {
  return profile.name?.trim() || "You";
}

export function statusLabel(status: LinkedInPostStatus): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "scheduled":
      return "Scheduled";
    case "published":
      return "Published";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

export function statusChipClass(status: LinkedInPostStatus): string {
  switch (status) {
    case "scheduled":
      return "bg-sky-50 text-sky-800 ring-sky-200";
    case "published":
      return "bg-emerald-50 text-emerald-800 ring-emerald-200";
    case "failed":
      return "bg-rose-50 text-rose-800 ring-rose-200";
    case "draft":
      return "bg-slate-100 text-slate-700 ring-slate-200";
    case "cancelled":
      return "bg-amber-50 text-amber-800 ring-amber-200";
    default:
      return "bg-slate-100 text-slate-600 ring-slate-200";
  }
}

export function postTypeLabel(type: LinkedInPostType): string {
  switch (type) {
    case "text":
      return "Text";
    case "image":
      return "Image";
    case "multi_image":
      return "Multi-image";
    case "article":
      return "Link";
    case "video":
      return "Video";
    case "document":
      return "Document";
    default:
      return type;
  }
}

export function isVideoMedia(media: Array<{ mime?: string }>): boolean {
  return media.some((m) => (m.mime || "").toLowerCase() === "video/mp4");
}

export function isDocumentMedia(media: Array<{ mime?: string }>): boolean {
  const docs = new Set([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ]);
  return media.some((m) => docs.has((m.mime || "").toLowerCase()));
}

export function inferComposerPostType(
  media: Array<{ mime?: string }>,
  articleUrl: string
): LinkedInPostType {
  if (articleUrl.trim()) return "article";
  if (isDocumentMedia(media)) return "document";
  if (isVideoMedia(media)) return "video";
  if (media.length >= 2) return "multi_image";
  if (media.length === 1) return "image";
  return "text";
}
