import { NextResponse } from "next/server";
import { requireContentPublisher } from "@/lib/linkedinAdminAuth";
import {
  inferPostType,
  normalizeMedia,
} from "@/lib/linkedinScheduledPosts";
import {
  publishPostViaUnipile,
  resolveUnipileAccountIdForUser,
} from "@/lib/unipile/publishing";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  isLinkedInDocumentMime,
  isLinkedInVideoMime,
  type LinkedInMediaItem,
  type LinkedInPostType,
} from "@/lib/linkedinPublishing";

export const maxDuration = 300;

type Body = {
  content?: string;
  post_type?: LinkedInPostType;
  category?: string | null;
  article_url?: string | null;
  article_title?: string | null;
  article_description?: string | null;
  article_thumbnail_url?: string | null;
  media?: LinkedInMediaItem[];
};

export async function POST(request: Request) {
  try {
    const auth = await requireContentPublisher(request);
    if (auth.error || !auth.userId) {
      return NextResponse.json(
        { error: auth.error ?? "Unauthorized" },
        { status: 401 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as Body;
    const content = body.content?.trim() ?? "";
    const media = normalizeMedia(body.media);
    const articleUrl = body.article_url?.trim() || null;
    const articleTitle = body.article_title?.trim() || null;
    const articleDescription = body.article_description?.trim() || null;
    const articleThumbnailUrl = body.article_thumbnail_url?.trim() || null;
    const postType = inferPostType(body.post_type, media, articleUrl);
    const category = body.category?.trim() || null;

    if (!content && postType === "text") {
      return NextResponse.json(
        { error: "Post content is required." },
        { status: 400 }
      );
    }
    if (postType === "image" && media.length < 1) {
      return NextResponse.json(
        { error: "Add an image for this post type." },
        { status: 400 }
      );
    }
    if (postType === "multi_image" && media.length < 2) {
      return NextResponse.json(
        { error: "Add at least 2 images for a multi-image post." },
        { status: 400 }
      );
    }
    if (postType === "video") {
      const videos = media.filter((m) => isLinkedInVideoMime(m.mime));
      if (videos.length !== 1 || media.length !== 1) {
        return NextResponse.json(
          {
            error: "A video post needs exactly one MP4 (no mixed images).",
          },
          { status: 400 }
        );
      }
    }
    if (postType === "document") {
      const docs = media.filter((m) => isLinkedInDocumentMime(m.mime));
      if (docs.length !== 1 || media.length !== 1) {
        return NextResponse.json(
          {
            error: "A document post needs exactly one PDF/DOC/PPT file.",
          },
          { status: 400 }
        );
      }
    }
    if (postType === "article") {
      if (!articleUrl) {
        return NextResponse.json(
          { error: "Article URL is required." },
          { status: 400 }
        );
      }
      if (!articleTitle) {
        return NextResponse.json(
          { error: "Link title is required." },
          { status: 400 }
        );
      }
    }

    const unipileAccountId = await resolveUnipileAccountIdForUser(auth.userId);
    if (!unipileAccountId) {
      return NextResponse.json(
        {
          error:
            "Connect LinkedIn in Campaigns first. Content posts through that same account.",
        },
        { status: 400 }
      );
    }

    const publish = await publishPostViaUnipile({
      unipileAccountId,
      content,
      postType,
      media,
      articleUrl,
    });
    if (!publish.ok) {
      return NextResponse.json({ error: publish.error }, { status: 502 });
    }

    const nowIso = new Date().toISOString();
    await supabaseAdmin.from("linkedin_scheduled_posts").insert({
      user_id: auth.userId,
      content,
      scheduled_for: nowIso,
      status: "published",
      attempts: 1,
      published_at: nowIso,
      linkedin_post_urn: publish.postId,
      post_type: postType,
      category,
      article_url: articleUrl,
      article_title: articleTitle,
      article_description: articleDescription,
      article_thumbnail_url: articleThumbnailUrl,
      media,
      last_error: null,
    });

    return NextResponse.json({
      ok: true,
      post_id: publish.postId,
      via: "unipile",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Publish failed." },
      { status: 500 }
    );
  }
}
