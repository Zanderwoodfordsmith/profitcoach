import { NextResponse } from "next/server";
import { requireContentPublisher } from "@/lib/linkedinAdminAuth";
import {
  createSignedMediaUrls,
  inferPostType,
  normalizeMedia,
  type LinkedInScheduledPostRow,
} from "@/lib/linkedinScheduledPosts";
import {
  isLinkedInDocumentMime,
  isLinkedInVideoMime,
  type LinkedInMediaItem,
  type LinkedInPostType,
} from "@/lib/linkedinPublishing";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const SELECT_COLS =
  "id, user_id, content, scheduled_for, status, attempts, last_error, linkedin_post_urn, published_at, created_at, updated_at, post_type, category, article_url, article_title, article_description, article_thumbnail_url, media, engagement, engagement_synced_at";

type Body = {
  content?: string;
  scheduled_for?: string | null;
  status?: "draft" | "scheduled";
  post_type?: LinkedInPostType;
  category?: string | null;
  article_url?: string | null;
  article_title?: string | null;
  article_description?: string | null;
  article_thumbnail_url?: string | null;
  media?: LinkedInMediaItem[];
};

async function attachSignedMedia(rows: LinkedInScheduledPostRow[]) {
  return Promise.all(
    rows.map(async (row) => {
      const media = normalizeMedia(row.media);
      const withUrls = await createSignedMediaUrls(media);
      return { ...row, media: withUrls };
    })
  );
}

export async function GET(request: Request) {
  const auth = await requireContentPublisher(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const category = url.searchParams.get("category");

  let query = supabaseAdmin
    .from("linkedin_scheduled_posts")
    .select(SELECT_COLS)
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (status && status !== "all") {
    query = query.eq("status", status);
  }
  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: "Could not load scheduled posts." }, { status: 500 });
  }

  const rows = (data ?? []).map((row) => ({
    ...row,
    media: normalizeMedia((row as { media?: unknown }).media),
  })) as LinkedInScheduledPostRow[];

  const items = await attachSignedMedia(rows);

  const categories = Array.from(
    new Set(
      rows
        .map((r) => r.category?.trim())
        .filter((c): c is string => !!c)
    )
  ).sort((a, b) => a.localeCompare(b));

  return NextResponse.json({ items, categories });
}

export async function POST(request: Request) {
  const auth = await requireContentPublisher(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
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
  const status = body.status === "draft" ? "draft" : "scheduled";

  if (!content && postType === "text") {
    return NextResponse.json({ error: "Post content is required." }, { status: 400 });
  }
  if (postType === "image" && media.length < 1) {
    return NextResponse.json({ error: "Add an image for this post type." }, { status: 400 });
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
        { error: "A video post needs exactly one MP4 (no mixed images)." },
        { status: 400 }
      );
    }
  }
  if (postType === "document") {
    const docs = media.filter((m) => isLinkedInDocumentMime(m.mime));
    if (docs.length !== 1 || media.length !== 1) {
      return NextResponse.json(
        { error: "A document post needs exactly one PDF/DOC/PPT file." },
        { status: 400 }
      );
    }
  }
  if (postType === "article") {
    if (!articleUrl) {
      return NextResponse.json({ error: "Article URL is required." }, { status: 400 });
    }
    if (!articleTitle) {
      return NextResponse.json(
        { error: "Link title is required (LinkedIn does not scrape it via API)." },
        { status: 400 }
      );
    }
  }

  let scheduledFor: string | null = null;
  if (status === "scheduled") {
    const raw = body.scheduled_for?.trim() ?? "";
    const when = new Date(raw);
    if (!raw || Number.isNaN(when.getTime())) {
      return NextResponse.json({ error: "Valid scheduled_for is required." }, { status: 400 });
    }
    if (when.getTime() < Date.now() + 60_000) {
      return NextResponse.json(
        {
          error: `Scheduled time must be at least 1 minute in the future (server time is UTC; the picker uses your local clock).`,
        },
        { status: 400 }
      );
    }
    scheduledFor = when.toISOString();
  }

  const { data, error } = await supabaseAdmin
    .from("linkedin_scheduled_posts")
    .insert({
      user_id: auth.userId,
      content,
      scheduled_for: scheduledFor,
      status,
      post_type: postType,
      category,
      article_url: articleUrl,
      article_title: articleTitle,
      article_description: articleDescription,
      article_thumbnail_url: articleThumbnailUrl,
      media,
    })
    .select(SELECT_COLS)
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message || "Could not create scheduled post." },
      { status: 500 }
    );
  }

  const row = {
    ...data,
    media: normalizeMedia((data as { media?: unknown }).media),
  } as LinkedInScheduledPostRow;
  const [item] = await attachSignedMedia([row]);

  return NextResponse.json({ ok: true, item });
}
