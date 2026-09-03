import { NextResponse } from "next/server";
import { requireContentPublisher } from "@/lib/linkedinAdminAuth";
import {
  createSignedMediaUrls,
  normalizeMedia,
  type LinkedInScheduledPostRow,
} from "@/lib/linkedinScheduledPosts";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const SELECT_COLS =
  "id, user_id, content, scheduled_for, status, attempts, last_error, linkedin_post_urn, published_at, created_at, updated_at, post_type, category, article_url, article_title, article_description, article_thumbnail_url, media, engagement, engagement_synced_at";

type PatchBody = {
  action?: "cancel" | "reschedule" | "clone" | "delete" | "update";
  scheduled_for?: string;
  content?: string;
  post_type?: string;
  category?: string | null;
  article_url?: string | null;
  article_title?: string | null;
  article_description?: string | null;
  article_thumbnail_url?: string | null;
  media?: unknown;
  status?: "draft" | "scheduled" | "cancelled";
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireContentPublisher(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Missing id." }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as PatchBody;
  const action = body.action ?? "cancel";

  const { data: existing, error: loadError } = await supabaseAdmin
    .from("linkedin_scheduled_posts")
    .select(SELECT_COLS)
    .eq("id", id)
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (loadError || !existing) {
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }

  if (action === "cancel") {
    if (existing.status !== "scheduled") {
      return NextResponse.json(
        { error: "Only scheduled posts can be cancelled." },
        { status: 400 }
      );
    }
    const { data, error } = await supabaseAdmin
      .from("linkedin_scheduled_posts")
      .update({ status: "cancelled" })
      .eq("id", id)
      .eq("user_id", auth.userId)
      .select(SELECT_COLS)
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      item: { ...data, media: normalizeMedia((data as { media?: unknown }).media) },
    });
  }

  if (action === "reschedule") {
    const raw = body.scheduled_for?.trim() ?? "";
    const when = new Date(raw);
    if (!raw || Number.isNaN(when.getTime())) {
      return NextResponse.json({ error: "Valid scheduled_for is required." }, { status: 400 });
    }
    if (when.getTime() < Date.now() + 60_000) {
      return NextResponse.json(
        { error: "Scheduled time must be at least 1 minute in the future." },
        { status: 400 }
      );
    }
    const { data, error } = await supabaseAdmin
      .from("linkedin_scheduled_posts")
      .update({
        scheduled_for: when.toISOString(),
        status: "scheduled",
        last_error: null,
        attempts: 0,
      })
      .eq("id", id)
      .eq("user_id", auth.userId)
      .select(SELECT_COLS)
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      item: { ...data, media: normalizeMedia((data as { media?: unknown }).media) },
    });
  }

  if (action === "clone") {
    const media = normalizeMedia((existing as { media?: unknown }).media);
    const raw = body.scheduled_for?.trim() ?? "";
    const when = raw ? new Date(raw) : null;
    const asDraft = !when || Number.isNaN(when.getTime());

    if (!asDraft && when && when.getTime() < Date.now() + 60_000) {
      return NextResponse.json(
        { error: "Scheduled time must be at least 1 minute in the future." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("linkedin_scheduled_posts")
      .insert({
        user_id: auth.userId,
        content: existing.content,
        post_type: existing.post_type,
        category: existing.category,
        article_url: existing.article_url,
        article_title: (existing as { article_title?: string | null }).article_title ?? null,
        article_description:
          (existing as { article_description?: string | null }).article_description ?? null,
        article_thumbnail_url:
          (existing as { article_thumbnail_url?: string | null }).article_thumbnail_url ?? null,
        media,
        status: asDraft ? "draft" : "scheduled",
        scheduled_for: asDraft ? null : when!.toISOString(),
      })
      .select(SELECT_COLS)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const row = {
      ...data,
      media: normalizeMedia((data as { media?: unknown }).media),
    } as LinkedInScheduledPostRow;
    const withUrls = await createSignedMediaUrls(row.media);
    return NextResponse.json({ ok: true, item: { ...row, media: withUrls } });
  }

  if (action === "update") {
    const media = normalizeMedia(body.media ?? (existing as { media?: unknown }).media);
    const content =
      typeof body.content === "string"
        ? body.content.trim()
        : String(existing.content ?? "");
    const nextStatus =
      body.status === "draft" || body.status === "scheduled" || body.status === "cancelled"
        ? body.status
        : (existing.status as string);

    let scheduledFor: string | null =
      (existing as { scheduled_for?: string | null }).scheduled_for ?? null;

    if (nextStatus === "draft") {
      scheduledFor = null;
    } else if (nextStatus === "scheduled") {
      const raw = body.scheduled_for?.trim();
      if (raw) {
        const when = new Date(raw);
        if (Number.isNaN(when.getTime())) {
          return NextResponse.json({ error: "Valid scheduled_for is required." }, { status: 400 });
        }
        if (when.getTime() < Date.now() + 60_000) {
          return NextResponse.json(
            { error: "Scheduled time must be at least 1 minute in the future." },
            { status: 400 }
          );
        }
        scheduledFor = when.toISOString();
      } else if (!scheduledFor) {
        return NextResponse.json(
          { error: "scheduled_for is required when status is scheduled." },
          { status: 400 }
        );
      }
    }

    // Published / failed rows can still have content/category edited for history,
    // but status stays unless moving back to draft/scheduled.
    const statusUpdate =
      existing.status === "published" && nextStatus === "published"
        ? "published"
        : nextStatus === "draft" || nextStatus === "scheduled" || nextStatus === "cancelled"
          ? nextStatus
          : existing.status === "failed" && (nextStatus === "draft" || nextStatus === "scheduled")
            ? nextStatus
            : existing.status;

    if (
      statusUpdate === "scheduled" &&
      scheduledFor &&
      new Date(scheduledFor).getTime() < Date.now() + 60_000 &&
      body.scheduled_for
    ) {
      // already validated above when body.scheduled_for set
    }

    const { data, error } = await supabaseAdmin
      .from("linkedin_scheduled_posts")
      .update({
        content,
        post_type: body.post_type || existing.post_type,
        category:
          body.category === undefined
            ? existing.category
            : body.category?.trim() || null,
        article_url:
          body.article_url === undefined
            ? existing.article_url
            : body.article_url?.trim() || null,
        article_title:
          body.article_title === undefined
            ? (existing as { article_title?: string | null }).article_title
            : body.article_title?.trim() || null,
        article_description:
          body.article_description === undefined
            ? (existing as { article_description?: string | null }).article_description
            : body.article_description?.trim() || null,
        article_thumbnail_url:
          body.article_thumbnail_url === undefined
            ? (existing as { article_thumbnail_url?: string | null }).article_thumbnail_url
            : body.article_thumbnail_url?.trim() || null,
        media,
        status: statusUpdate,
        scheduled_for: statusUpdate === "draft" ? null : scheduledFor,
        last_error: statusUpdate === "scheduled" ? null : existing.last_error,
        attempts: statusUpdate === "scheduled" ? 0 : existing.attempts,
      })
      .eq("id", id)
      .eq("user_id", auth.userId)
      .select(SELECT_COLS)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const row = {
      ...data,
      media: normalizeMedia((data as { media?: unknown }).media),
    } as LinkedInScheduledPostRow;
    const withUrls = await createSignedMediaUrls(row.media);
    return NextResponse.json({ ok: true, item: { ...row, media: withUrls } });
  }

  if (action === "delete") {
    const { error } = await supabaseAdmin
      .from("linkedin_scheduled_posts")
      .delete()
      .eq("id", id)
      .eq("user_id", auth.userId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireContentPublisher(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  const { error } = await supabaseAdmin
    .from("linkedin_scheduled_posts")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.userId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
