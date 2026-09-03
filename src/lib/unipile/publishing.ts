import { createUnipilePost } from "@/lib/unipile/client";
import {
  LINKEDIN_MEDIA_BUCKET,
  type LinkedInScheduledPostRow,
} from "@/lib/linkedinScheduledPosts";
import type { LinkedInMediaItem, LinkedInPostType } from "@/lib/linkedinPublishing";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function mediaToAttachments(
  media: LinkedInMediaItem[]
): Promise<Array<{ blob: Blob; filename: string }>> {
  const out: Array<{ blob: Blob; filename: string }> = [];
  for (const item of media) {
    const { data, error } = await supabaseAdmin.storage
      .from(LINKEDIN_MEDIA_BUCKET)
      .download(item.path);
    if (error || !data) {
      throw new Error(
        `Could not load media from storage: ${error?.message ?? item.path}`
      );
    }
    const filename =
      item.filename || item.path.split("/").pop() || "attachment";
    out.push({
      blob: new Blob([await data.arrayBuffer()], {
        type: item.mime || "application/octet-stream",
      }),
      filename,
    });
  }
  return out;
}

/**
 * Publish via Unipile (same LinkedIn session as outreach).
 * Prefer this over official OAuth for coach Content.
 */
export async function publishPostViaUnipile(input: {
  unipileAccountId: string;
  content: string;
  postType: LinkedInPostType;
  media: LinkedInMediaItem[];
  articleUrl?: string | null;
}): Promise<{ ok: true; postId: string | null } | { ok: false; error: string }> {
  try {
    const attachments =
      input.postType === "text" || input.postType === "article"
        ? []
        : await mediaToAttachments(input.media);

    const res = await createUnipilePost({
      account_id: input.unipileAccountId,
      text: input.content,
      attachments: attachments.length ? attachments : undefined,
      external_link: input.articleUrl?.trim() || null,
    });

    if (!res.ok) {
      return { ok: false, error: res.error || "Unipile publish failed." };
    }
    return { ok: true, postId: res.data?.post_id ?? null };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unipile publish failed.",
    };
  }
}

export async function resolveUnipileAccountIdForUser(
  userId: string
): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("linkedin_outreach_accounts")
    .select("unipile_account_id")
    .eq("coach_id", userId)
    .eq("status", "OK")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.unipile_account_id as string) || null;
}

export async function publishScheduledRowViaUnipile(
  row: Pick<
    LinkedInScheduledPostRow,
    | "content"
    | "post_type"
    | "media"
    | "article_url"
  > & { user_id: string }
): Promise<{ ok: true; postId: string | null } | { ok: false; error: string }> {
  const accountId = await resolveUnipileAccountIdForUser(row.user_id);
  if (!accountId) {
    return {
      ok: false,
      error:
        "Connect LinkedIn in Campaigns first (Unipile). Content now posts through that same account.",
    };
  }
  return publishPostViaUnipile({
    unipileAccountId: accountId,
    content: row.content,
    postType: row.post_type,
    media: row.media,
    articleUrl: row.article_url,
  });
}
