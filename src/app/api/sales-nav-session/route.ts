import { NextResponse } from "next/server";
import { requireLeadFinderAccess } from "@/lib/requireLeadFinderAccess";
import {
  deleteSalesNavSession,
  getSalesNavSessionMeta,
  upsertSalesNavSession,
} from "@/lib/salesNavigator/sessionStore";

/**
 * Per-user Sales Navigator cookie session.
 * Used by the Chrome extension and Lead Finder.
 * Auth: Lead Finder allowlist for now (same as import).
 */

export async function GET(request: Request) {
  const auth = await requireLeadFinderAccess(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json(
      { error: auth.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  const meta = await getSalesNavSessionMeta(auth.userId);
  return NextResponse.json({
    hasSession: Boolean(meta?.hasCookie),
    updatedAt: meta?.updatedAt ?? null,
  });
}

export async function PUT(request: Request) {
  const auth = await requireLeadFinderAccess(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json(
      { error: auth.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    cookie?: string;
    userAgent?: string;
  };

  const cookie = body.cookie?.trim() ?? "";
  if (!cookie) {
    return NextResponse.json(
      { error: "Missing cookie payload." },
      { status: 400 }
    );
  }

  // Basic shape check: Cookie-Editor JSON array or li_at string.
  if (
    !cookie.startsWith("[") &&
    !cookie.includes("li_at") &&
    !cookie.startsWith("{")
  ) {
    return NextResponse.json(
      { error: "Cookie payload does not look like LinkedIn session data." },
      { status: 400 }
    );
  }

  try {
    const meta = await upsertSalesNavSession({
      userId: auth.userId,
      cookieJson: cookie,
      userAgent: body.userAgent,
    });
    return NextResponse.json({
      ok: true,
      hasSession: true,
      updatedAt: meta.updatedAt,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not save session.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireLeadFinderAccess(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json(
      { error: auth.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    await deleteSalesNavSession(auth.userId);
    return NextResponse.json({ ok: true, hasSession: false });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not clear session.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
