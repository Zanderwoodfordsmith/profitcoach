import {
  isLinkedInDocumentMime,
  isLinkedInVideoMime,
  publishLinkedInPost,
  resolveLinkedInAuthorUrn,
  uploadLinkedInDocument,
  uploadLinkedInImage,
  uploadLinkedInVideo,
  type LinkedInConnection,
  type LinkedInMediaItem,
  type LinkedInPostType,
} from "@/lib/linkedinPublishing";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const LINKEDIN_MEDIA_BUCKET = "linkedin-media";

export type LinkedInScheduledPostRow = {
  id: string;
  user_id: string;
  content: string;
  scheduled_for: string | null;
  status: "draft" | "scheduled" | "published" | "failed" | "cancelled";
  attempts: number;
  last_error: string | null;
  linkedin_post_urn: string | null;
  published_at: string | null;
  created_at: string;
  updated_at?: string;
  post_type: LinkedInPostType;
  category: string | null;
  article_url: string | null;
  article_title: string | null;
  article_description: string | null;
  article_thumbnail_url: string | null;
  media: LinkedInMediaItem[];
};

export function normalizeMedia(raw: unknown): LinkedInMediaItem[] {
  if (!Array.isArray(raw)) return [];
  const out: LinkedInMediaItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const path = typeof r.path === "string" ? r.path : "";
    const mime = typeof r.mime === "string" ? r.mime : "image/jpeg";
    const size = typeof r.size === "number" ? r.size : 0;
    if (!path) continue;
    const entry: LinkedInMediaItem = { path, mime, size };
    if (typeof r.altText === "string") entry.altText = r.altText;
    if (typeof r.filename === "string") entry.filename = r.filename;
    out.push(entry);
  }
  return out;
}

export function inferPostType(
  postType: string | undefined,
  media: LinkedInMediaItem[],
  articleUrl: string | null | undefined
): LinkedInPostType {
  if (
    postType === "text" ||
    postType === "image" ||
    postType === "multi_image" ||
    postType === "article" ||
    postType === "video" ||
    postType === "document"
  ) {
    return postType;
  }
  if (articleUrl?.trim()) return "article";
  if (media.some((m) => isLinkedInDocumentMime(m.mime))) return "document";
  if (media.some((m) => isLinkedInVideoMime(m.mime))) return "video";
  if (media.length >= 2) return "multi_image";
  if (media.length === 1) return "image";
  return "text";
}

export async function createSignedMediaUrls(
  media: LinkedInMediaItem[],
  expiresIn = 3600
): Promise<Array<LinkedInMediaItem & { signedUrl: string | null }>> {
  const out: Array<LinkedInMediaItem & { signedUrl: string | null }> = [];
  for (const item of media) {
    const { data } = await supabaseAdmin.storage
      .from(LINKEDIN_MEDIA_BUCKET)
      .createSignedUrl(item.path, expiresIn);
    out.push({ ...item, signedUrl: data?.signedUrl ?? null });
  }
  return out;
}

async function uploadRemoteImageAsLinkedInUrn(
  connection: LinkedInConnection,
  ownerUrn: string,
  imageUrl: string
): Promise<string | null> {
  try {
    const res = await fetch(imageUrl, {
      redirect: "follow",
      cache: "no-store",
      headers: { Accept: "image/*" },
    });
    if (!res.ok) return null;
    const contentType = (res.headers.get("content-type") || "image/jpeg")
      .split(";")[0]!
      .trim()
      .toLowerCase();
    if (!contentType.startsWith("image/")) return null;
    const bytes = await res.arrayBuffer();
    if (bytes.byteLength < 100 || bytes.byteLength > 8 * 1024 * 1024) return null;
    const uploaded = await uploadLinkedInImage(
      connection,
      ownerUrn,
      bytes,
      contentType.startsWith("image/") ? contentType : "image/jpeg"
    );
    return uploaded.ok ? uploaded.imageUrn : null;
  } catch {
    return null;
  }
}

export async function publishStoredLinkedInPost(opts: {
  connection: LinkedInConnection;
  content: string;
  postType: LinkedInPostType;
  media: LinkedInMediaItem[];
  articleUrl?: string | null;
  articleTitle?: string | null;
  articleDescription?: string | null;
  articleThumbnailUrl?: string | null;
}): Promise<{ ok: true; postUrn: string | null } | { ok: false; error: string }> {
  const author = await resolveLinkedInAuthorUrn(opts.connection);
  const imageUrns: string[] = [];
  let videoUrn: string | null = null;
  let documentUrn: string | null = null;
  let documentTitle: string | null = null;
  let articleThumbnailUrn: string | null = null;

  if (opts.postType === "video") {
    const video = opts.media.find((m) => isLinkedInVideoMime(m.mime)) ?? opts.media[0];
    if (!video) {
      return { ok: false, error: "Video post is missing a video file." };
    }
    const { data, error } = await supabaseAdmin.storage
      .from(LINKEDIN_MEDIA_BUCKET)
      .download(video.path);
    if (error || !data) {
      return {
        ok: false,
        error: `Could not load video from storage: ${error?.message ?? video.path}`,
      };
    }
    const bytes = await data.arrayBuffer();
    const uploaded = await uploadLinkedInVideo(opts.connection, author, bytes);
    if (!uploaded.ok) return uploaded;
    videoUrn = uploaded.videoUrn;
  } else if (opts.postType === "document") {
    const doc =
      opts.media.find((m) => isLinkedInDocumentMime(m.mime)) ?? opts.media[0];
    if (!doc) {
      return { ok: false, error: "Document post is missing a file." };
    }
    const { data, error } = await supabaseAdmin.storage
      .from(LINKEDIN_MEDIA_BUCKET)
      .download(doc.path);
    if (error || !data) {
      return {
        ok: false,
        error: `Could not load document from storage: ${error?.message ?? doc.path}`,
      };
    }
    const bytes = await data.arrayBuffer();
    const uploaded = await uploadLinkedInDocument(
      opts.connection,
      author,
      bytes,
      doc.mime || "application/pdf"
    );
    if (!uploaded.ok) return uploaded;
    documentUrn = uploaded.documentUrn;
    documentTitle =
      doc.filename ||
      doc.path.split("/").pop() ||
      "Document";
  } else if (opts.postType === "image" || opts.postType === "multi_image") {
    for (const item of opts.media) {
      const { data, error } = await supabaseAdmin.storage
        .from(LINKEDIN_MEDIA_BUCKET)
        .download(item.path);
      if (error || !data) {
        return {
          ok: false,
          error: `Could not load media from storage: ${error?.message ?? item.path}`,
        };
      }
      const bytes = await data.arrayBuffer();
      const uploaded = await uploadLinkedInImage(
        opts.connection,
        author,
        bytes,
        item.mime || "image/jpeg"
      );
      if (!uploaded.ok) return uploaded;
      imageUrns.push(uploaded.imageUrn);
    }
  } else if (opts.postType === "article" && opts.articleThumbnailUrl?.trim()) {
    articleThumbnailUrn = await uploadRemoteImageAsLinkedInUrn(
      opts.connection,
      author,
      opts.articleThumbnailUrl.trim()
    );
  }

  return publishLinkedInPost({
    connection: opts.connection,
    commentary: opts.content,
    postType: opts.postType,
    imageUrns,
    videoUrn,
    documentUrn,
    documentTitle,
    articleUrl: opts.articleUrl,
    articleTitle: opts.articleTitle,
    articleDescription: opts.articleDescription,
    articleThumbnailUrn,
  });
}
