import { after, NextResponse } from "next/server";
import { isAlertsNotifyName, upsertAlertsWhatsAppFromNotify } from "@/lib/ava/alertsWhatsApp";
import { loadCoachOwnLinkedInSsi } from "@/lib/unipile/linkedinSsi";
import { upsertOutreachAccountFromNotify } from "@/lib/unipile/outreachAccounts";
import {
  connectedByFromNotifyName,
  isSupportMailboxNotifyName,
  upsertSupportMailboxFromNotify,
} from "@/lib/support/mailbox";
import {
  adminIdFromSupportWhatsAppNotifyName,
  isSupportWhatsAppNotifyName,
  upsertSupportWhatsAppLine,
} from "@/lib/support/whatsapp";

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

  // BCA's alerts WhatsApp (Ava) — never write coach outreach rows.
  if (isAlertsNotifyName(name)) {
    try {
      await upsertAlertsWhatsAppFromNotify({ unipileAccountId, name });
      return NextResponse.json({ ok: true, purpose: "alerts" });
    } catch (err) {
      console.error("unipile alerts notify:", err);
      return NextResponse.json({ error: "Notify failed" }, { status: 500 });
    }
  }

  // An admin's own WhatsApp for Support — never write coach outreach rows.
  if (isSupportWhatsAppNotifyName(name)) {
    const adminId = adminIdFromSupportWhatsAppNotifyName(name);
    if (!adminId) return NextResponse.json({ ok: true, ignored: true });
    try {
      await upsertSupportWhatsAppLine({ unipileAccountId, adminId });
      const { ensureUnipileWebhooksRegistered } = await import("@/lib/unipile/webhooks");
      void ensureUnipileWebhooksRegistered(request).catch((err) => {
        console.warn("unipile webhook register:", err);
      });
      return NextResponse.json({ ok: true, purpose: "support_whatsapp" });
    } catch (err) {
      console.error("unipile support whatsapp notify:", err);
      return NextResponse.json({ error: "Notify failed" }, { status: 500 });
    }
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
    // Load their SSI as soon as LinkedIn connects, not only when they open it (23 Nov).
    after(() =>
      loadCoachOwnLinkedInSsi(name, { refresh: true }).catch((err) => {
        console.warn("ssi on connect:", err instanceof Error ? err.message : "failed");
      })
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("unipile notify:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Notify failed" },
      { status: 500 }
    );
  }
}
