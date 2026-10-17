import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  createHostedAuthLink,
  getUnipileAccount,
  getUnipileDsn,
  isUnipileConfigured,
  sendUnipileChatMessage,
  startUnipileChat,
} from "@/lib/unipile/client";

/**
 * BCA's own WhatsApp number, used only to send Ava's alerts to coaches.
 * Stored in platform_unipile_accounts with purpose "alerts", separate from
 * every coach's accounts, so its chats never reach a coach's Conversations.
 */

export const ALERTS_NOTIFY_PREFIX = "platform-alerts";

export type AlertsAccount = {
  id: string;
  unipile_account_id: string;
  status: string;
  display_name: string | null;
};

export function isAlertsNotifyName(name: string): boolean {
  return name.trim().toLowerCase().startsWith(ALERTS_NOTIFY_PREFIX);
}

function connectedByFromName(name: string): string | null {
  const id = name.trim().slice(ALERTS_NOTIFY_PREFIX.length + 1).trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : null;
}

export async function getAlertsWhatsAppAccount(): Promise<AlertsAccount | null> {
  const { data } = await supabaseAdmin
    .from("platform_unipile_accounts")
    .select("id, unipile_account_id, status, display_name")
    .eq("purpose", "alerts")
    .maybeSingle();
  return (data as AlertsAccount | null) ?? null;
}

export async function createAlertsWhatsAppConnectLink(adminUserId: string, appBase: string): Promise<{ url: string }> {
  if (!isUnipileConfigured()) throw new Error("Unipile is not configured.");
  const existing = await getAlertsWhatsAppAccount();
  const result = await createHostedAuthLink({
    type: existing ? "reconnect" : "create",
    apiUrl: getUnipileDsn(),
    expiresOn: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    providers: ["WHATSAPP"],
    name: `${ALERTS_NOTIFY_PREFIX}:${adminUserId}`,
    success_redirect_url: `${appBase}/admin/ava/replies?whatsapp=connected`,
    failure_redirect_url: `${appBase}/admin/ava/replies?whatsapp=failed`,
    notify_url: `${appBase}/api/unipile/notify`,
    bypass_success_screen: true,
    ...(existing ? { reconnect_account: existing.unipile_account_id } : {}),
  });
  if (!result.ok || !result.data?.url) throw new Error(result.error || "Could not create a WhatsApp connect link.");
  return { url: result.data.url };
}

export async function upsertAlertsWhatsAppFromNotify(input: { unipileAccountId: string; name: string }): Promise<void> {
  const got = await getUnipileAccount(input.unipileAccountId);
  const raw = (got.data ?? { id: input.unipileAccountId }) as Record<string, unknown>;
  const display = typeof raw.name === "string" ? raw.name : null;
  const { error } = await supabaseAdmin.from("platform_unipile_accounts").upsert(
    {
      purpose: "alerts",
      unipile_account_id: input.unipileAccountId,
      provider: "WHATSAPP",
      status: "OK",
      display_name: display,
      connected_by: connectedByFromName(input.name),
      raw,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "purpose" }
  );
  if (error) throw new Error(error.message);
}

/** Digits only, with a UK default for numbers written as 07... */
export function whatsappIdForPhone(phone: string | null | undefined): string | null {
  let digits = (phone || "").replace(/[^\d+]/g, "");
  if (!digits) return null;
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = `44${digits.slice(1)}`;
  digits = digits.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

/** Send one alert from BCA's WhatsApp to a coach's phone. */
export async function sendAlertWhatsApp(phone: string | null | undefined, text: string): Promise<boolean> {
  const account = await getAlertsWhatsAppAccount();
  const to = whatsappIdForPhone(phone);
  if (!account || account.status !== "OK" || !to) return false;
  const attendee = `${to}@s.whatsapp.net`;
  const started = await startUnipileChat({
    account_id: account.unipile_account_id,
    attendees_ids: [attendee],
    text,
  });
  if (started.ok) return true;
  if (started.data?.chat_id) {
    const sent = await sendUnipileChatMessage({ chat_id: started.data.chat_id, account_id: account.unipile_account_id, text });
    return sent.ok;
  }
  console.error("alerts whatsapp:", started.error);
  return false;
}
