import { NextResponse } from "next/server";
import { WHATSAPP_ANNOUNCEMENTS_GROUP } from "@/config/whatsappAnnouncements";
import { getPublicAppBaseUrl } from "@/lib/appBaseUrl";
import { toWhatsAppText } from "@/lib/community/announcementWriter";
import { communityPostPath } from "@/lib/communityPostSlug";
import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  isUnipileConfigured,
  listUnipileChats,
  sendUnipileChatMessage,
} from "@/lib/unipile/client";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Announcements → WhatsApp group, sent from the poster's own linked WhatsApp.
 *
 * GET  → { linked, reason } for the signed-in admin (greys out the tick).
 * POST { postId } → sends that post. Only the post's own author can send it,
 *   only for a live Announcements post made in the last 15 minutes.
 */

const MAX_CHAT_PAGES = 15;
const SEND_WINDOW_MS = 15 * 60 * 1000;

async function okWhatsAppAccountId(profileId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("linkedin_outreach_accounts")
    .select("unipile_account_id, provider, status")
    .eq("coach_id", profileId);
  const row = (data ?? []).find(
    (r) =>
      String(r.provider || "").toUpperCase() === "WHATSAPP" &&
      String(r.status || "").toUpperCase() === "OK" &&
      Boolean(String(r.unipile_account_id || "").trim())
  );
  return row ? String(row.unipile_account_id).trim() : null;
}

/** The group's chat id on this account (chat ids differ per account). */
async function findGroupChatId(accountId: string): Promise<string | null> {
  let cursor: string | null = null;
  for (let page = 0; page < MAX_CHAT_PAGES; page += 1) {
    const res = await listUnipileChats({ account_id: accountId, limit: 100, cursor });
    if (!res.ok) throw new Error(res.error || `list chats ${res.status}`);
    for (const chat of res.data?.items ?? []) {
      if (chat.provider_id === WHATSAPP_ANNOUNCEMENTS_GROUP.providerId) {
        return typeof chat.id === "string" ? chat.id : null;
      }
    }
    cursor = res.data?.cursor ?? null;
    if (!cursor) break;
  }
  return null;
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  if (!isUnipileConfigured()) {
    return NextResponse.json({
      linked: false,
      reason: "WhatsApp sending isn't set up on this server.",
    });
  }
  const accountId = await okWhatsAppAccountId(auth.userId);
  return NextResponse.json({
    linked: Boolean(accountId),
    group: WHATSAPP_ANNOUNCEMENTS_GROUP.name,
    reason: accountId
      ? null
      : "Link your WhatsApp first (Settings → Integrations).",
  });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { postId?: unknown };
  const postId = typeof body.postId === "string" ? body.postId.trim() : "";
  if (!postId) {
    return NextResponse.json({ error: "Missing post." }, { status: 400 });
  }

  const { data: post } = await supabaseAdmin
    .from("community_posts")
    .select(
      "id, title, body, author_id, created_at, published_at, category:community_categories (slug)"
    )
    .eq("id", postId)
    .maybeSingle();
  if (!post) {
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }
  const category = Array.isArray(post.category) ? post.category[0] : post.category;
  if ((category as { slug?: string } | null)?.slug !== "announcements") {
    return NextResponse.json(
      { error: "Only Announcements go to WhatsApp." },
      { status: 400 }
    );
  }
  if (post.author_id !== auth.userId) {
    return NextResponse.json(
      { error: "Only the person who posted it can send it to WhatsApp." },
      { status: 403 }
    );
  }
  const now = Date.now();
  if (
    Date.parse(String(post.published_at)) > now ||
    now - Date.parse(String(post.created_at)) > SEND_WINDOW_MS
  ) {
    return NextResponse.json(
      { error: "Only a post made just now can go to WhatsApp." },
      { status: 400 }
    );
  }

  if (!isUnipileConfigured()) {
    return NextResponse.json(
      { error: "WhatsApp sending isn't set up on this server." },
      { status: 503 }
    );
  }
  const accountId = await okWhatsAppAccountId(auth.userId);
  if (!accountId) {
    return NextResponse.json(
      { error: "Your WhatsApp isn't linked. Settings → Integrations." },
      { status: 400 }
    );
  }

  try {
    const chatId = await findGroupChatId(accountId);
    if (!chatId) {
      return NextResponse.json(
        {
          error: `Couldn't find the ${WHATSAPP_ANNOUNCEMENTS_GROUP.name} group on your WhatsApp.`,
        },
        { status: 404 }
      );
    }
    const postUrl = `${getPublicAppBaseUrl(request)}${communityPostPath(
      "/coach/community",
      { title: String(post.title ?? "") }
    )}`;
    const sent = await sendUnipileChatMessage({
      chat_id: chatId,
      account_id: accountId,
      text: toWhatsAppText({
        title: String(post.title ?? ""),
        body: String(post.body ?? ""),
        postUrl,
      }),
    });
    if (!sent.ok) throw new Error(sent.error || `send ${sent.status}`);
    return NextResponse.json({ ok: true, group: WHATSAPP_ANNOUNCEMENTS_GROUP.name });
  } catch (err) {
    console.error(
      "whatsapp-announce:",
      err instanceof Error ? err.message : "failed"
    );
    return NextResponse.json(
      { error: "WhatsApp didn't send. Try posting it there by hand." },
      { status: 502 }
    );
  }
}
