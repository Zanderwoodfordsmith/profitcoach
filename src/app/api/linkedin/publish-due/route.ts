import { NextResponse } from "next/server";
import { requireContentPublisher } from "@/lib/linkedinAdminAuth";
import {
  inferPostType,
  normalizeMedia,
} from "@/lib/linkedinScheduledPosts";
import {
  publishScheduledRowViaUnipile,
} from "@/lib/unipile/publishing";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { LinkedInPostType } from "@/lib/linkedinPublishing";

export const maxDuration = 300;

type DueItem = {
  id: string;
  user_id: string;
  content: string;
  attempts: number;
  post_type: LinkedInPostType | string;
  article_url: string | null;
  article_title: string | null;
  article_description: string | null;
  article_thumbnail_url: string | null;
  media: unknown;
};

function isCronRequest(request: Request): boolean {
  if (request.headers.get("x-vercel-cron") === "1") return true;
  const auth = request.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const secrets = [
    process.env.CRON_SECRET?.trim(),
    process.env.LINKEDIN_CRON_SECRET?.trim(),
  ].filter(Boolean) as string[];
  return !!bearer && secrets.includes(bearer);
}

async function publishOne(
  item: DueItem
): Promise<{ id: string; ok: boolean; error?: string }> {
  const media = normalizeMedia(item.media);
  const postType = inferPostType(
    typeof item.post_type === "string" ? item.post_type : undefined,
    media,
    item.article_url
  );
  const result = await publishScheduledRowViaUnipile({
    user_id: item.user_id,
    content: item.content,
    post_type: postType,
    media,
    article_url: item.article_url,
  });
  if (result.ok) {
    await supabaseAdmin
      .from("linkedin_scheduled_posts")
      .update({
        status: "published",
        attempts: item.attempts + 1,
        published_at: new Date().toISOString(),
        linkedin_post_urn: result.postId,
        last_error: null,
      })
      .eq("id", item.id);
    return { id: item.id, ok: true };
  }

  await supabaseAdmin
    .from("linkedin_scheduled_posts")
    .update({
      status: item.attempts + 1 >= 3 ? "failed" : "scheduled",
      attempts: item.attempts + 1,
      last_error: result.error,
    })
    .eq("id", item.id);
  return { id: item.id, ok: false, error: result.error };
}

async function loadDue(userId?: string): Promise<DueItem[]> {
  let query = supabaseAdmin
    .from("linkedin_scheduled_posts")
    .select(
      "id, user_id, content, attempts, post_type, article_url, article_title, article_description, article_thumbnail_url, media"
    )
    .eq("status", "scheduled")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(40);

  if (userId) query = query.eq("user_id", userId);

  const { data, error } = await query;
  if (error) throw new Error(error.message || "Could not load due posts.");
  return (data ?? []) as DueItem[];
}

/**
 * Publish scheduled LinkedIn posts whose scheduled_for has passed.
 * Uses Unipile (same account as Campaigns).
 */
export async function POST(request: Request) {
  try {
    const cron = isCronRequest(request);
    let scopeUserId: string | null = null;

    if (!cron) {
      const auth = await requireContentPublisher(request);
      if (auth.error || !auth.userId) {
        return NextResponse.json(
          { error: auth.error ?? "Unauthorized" },
          { status: 401 }
        );
      }
      scopeUserId = auth.userId;
    }

    const items = await loadDue(scopeUserId ?? undefined);
    if (!items.length) {
      return NextResponse.json({ processed: 0, published: 0, results: [] });
    }

    const out: Array<{ id: string; ok: boolean; error?: string }> = [];
    let published = 0;

    for (const item of items) {
      const result = await publishOne(item);
      out.push(result);
      if (result.ok) published += 1;
    }

    return NextResponse.json({
      processed: items.length,
      published,
      results: out,
      via: "unipile",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Publish-due failed." },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return POST(request);
}
