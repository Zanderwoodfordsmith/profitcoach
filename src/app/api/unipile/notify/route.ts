import { NextResponse } from "next/server";
import { upsertOutreachAccountFromNotify } from "@/lib/unipile/accounts";

/**
 * Unipile hosted-auth notify webhook.
 * `name` was set to coachId when creating the link.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  const coachId = String(body.name || body.Name || "").trim();
  const accountId = String(
    body.account_id || body.AccountStatus || body.id || ""
  ).trim();

  // Some Unipile payloads nest account
  const nested = body.account as Record<string, unknown> | undefined;
  const unipileAccountId =
    accountId ||
    String(nested?.id || body.AccountId || "").trim();

  if (!coachId || !unipileAccountId) {
    console.warn("unipile notify missing coach/account", {
      keys: Object.keys(body),
    });
    return NextResponse.json({ ok: true, ignored: true });
  }

  // Coach ids are UUIDs
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      coachId
    )
  ) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    await upsertOutreachAccountFromNotify({
      coachId,
      unipileAccountId,
    });
    // Best-effort: register messaging / relation webhooks once account exists
    const { ensureUnipileWebhooksRegistered } = await import(
      "@/lib/unipile/webhooks"
    );
    void ensureUnipileWebhooksRegistered(request).catch((err) => {
      console.warn("unipile webhook register:", err);
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("unipile notify:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Notify failed" },
      { status: 500 }
    );
  }
}
