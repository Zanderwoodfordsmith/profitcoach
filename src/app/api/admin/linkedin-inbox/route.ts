import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import type { MirrorConversation } from "@/lib/linkedinMessaging/fetchInbox";
import {
  getInboxSnapshot,
  upsertInboxSnapshot,
} from "@/lib/linkedinMessaging/snapshotStore";

/**
 * Admin LinkedIn mirror inbox.
 * GET  → last snapshot saved from the extension (preferred).
 * POST → save a snapshot { conversations } from the extension,
 *        or legacy cookie scrape (usually 401 from cloud IPs).
 */
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json(
      { error: auth.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  const snapshot = await getInboxSnapshot(auth.userId);
  if (!snapshot) {
    return NextResponse.json({
      ok: true,
      conversations: [],
      scrapedAt: null,
      source: null,
      empty: true,
      hint: "Use the Chrome extension side panel → Sync LI Inbox (scrapes from your browser IP).",
    });
  }

  return NextResponse.json({
    ok: true,
    conversations: snapshot.conversations,
    scrapedAt: snapshot.scrapedAt,
    source: snapshot.source,
    warning: snapshot.warning,
  });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json(
      { error: auth.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    conversations?: MirrorConversation[];
    scrapedAt?: string;
    source?: string;
    warning?: string | null;
    /** Legacy: server-side cookie scrape (often 401). */
    cookie?: string;
    userAgent?: string;
    limit?: number;
  };

  if (Array.isArray(body.conversations)) {
    try {
      const saved = await upsertInboxSnapshot({
        userId: auth.userId,
        conversations: body.conversations,
        scrapedAt: body.scrapedAt,
        source: body.source || "extension",
        warning: body.warning ?? null,
      });
      return NextResponse.json({ ok: true, ...saved });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not save inbox snapshot.";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // Legacy server cookie path — kept for debugging; expect cloud 401s.
  if (body.cookie?.trim()) {
    try {
      const { fetchLinkedInMirrorInbox } = await import(
        "@/lib/linkedinMessaging/fetchInbox"
      );
      const result = await fetchLinkedInMirrorInbox({
        cookie: body.cookie,
        userAgent: body.userAgent,
        limit: body.limit ?? 3,
      });
      const saved = await upsertInboxSnapshot({
        userId: auth.userId,
        conversations: result.conversations,
        scrapedAt: result.scrapedAt,
        source: "server_cookie",
        warning: result.warning ?? null,
      });
      return NextResponse.json({ ok: true, ...saved });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not scrape LinkedIn inbox.";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  return NextResponse.json(
    {
      error:
        "Send conversations from the extension (recommended), or a cookie for the legacy server scrape.",
    },
    { status: 400 }
  );
}
