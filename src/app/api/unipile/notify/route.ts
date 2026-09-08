import { NextResponse } from "next/server";
import { upsertOutreachAccountFromNotify } from "@/lib/unipile/accounts";
import {
  connectedByFromNotifyName,
  isSupportMailboxNotifyName,
  upsertSupportMailboxFromNotify,
} from "@/lib/support/mailbox";

/**
 * Unipile hosted-auth notify webhook.
 * Coach: `name` = coach UUID → linkedin_outreach_accounts.
 * Support: `name` = platform-support[:adminUuid] → platform_unipile_accounts only.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  const name = String(body.name || body.Name || "").trim();
  const accountId = String(
    body.account_id || body.AccountStatus || body.id || ""
  ).trim();

  const nested = body.account as Record<string, unknown> | undefined;
  const unipileAccountId =
    accountId ||
    String(nested?.id || body.AccountId || "").trim();

  if (!name || !unipileAccountId) {
    console.warn("unipile notify missing name/account", {
      keys: Object.keys(body),
    });
    return NextResponse.json({ ok: true, ignored: true });
  }

  // Dedicated Support mailbox — never write coach outreach rows.
  if (isSupportMailboxNotifyName(name)) {
    try {
      await upsertSupportMailboxFromNotify({
        unipileAccountId,
        connectedBy: connectedByFromNotifyName(name),
      });
      const { ensureUnipileWebhooksRegistered } = await import(
        "@/lib/unipile/webhooks"
      );
      void ensureUnipileWebhooksRegistered(request).catch((err) => {
        console.warn("unipile webhook register:", err);
      });
      return NextResponse.json({ ok: true, purpose: "support" });
    } catch (err) {
      console.error("unipile support notify:", err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Notify failed" },
        { status: 500 }
      );
    }
  }

  // Coach ids are UUIDs
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      name
    )
  ) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    await upsertOutreachAccountFromNotify({
      coachId: name,
      unipileAccountId,
    });
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
