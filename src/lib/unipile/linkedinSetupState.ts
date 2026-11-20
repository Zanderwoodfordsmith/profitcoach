import { getUnipileAccount, isUnipileAccountNotFound } from "@/lib/unipile/client";
import { listOutreachAccounts } from "@/lib/unipile/outreachAccounts";
import { normalizeUnipileProvider } from "@/lib/unipile/providers";

/**
 * What the coach's LinkedIn needs before BCA can build their lists and run
 * their campaigns (20 Nov): "ok", "connect", "reconnect", or "sales_navigator"
 * (connected, but Sales Navigator searches are refused without it).
 */
export type LinkedInSetupState = "ok" | "connect" | "reconnect" | "sales_navigator";

export async function linkedInSetupState(coachId: string): Promise<LinkedInSetupState> {
  const rows = (await listOutreachAccounts(coachId)).filter(
    (row) => normalizeUnipileProvider(row.provider) === "LINKEDIN" && row.unipile_account_id?.trim()
  );
  const status = (s: string | null | undefined) => (s || "").toUpperCase();
  const connected = rows.find((row) => status(row.status) === "OK");
  if (!connected) {
    // A half-finished connect (CONNECTING) just needs connecting again; anything else lost its login.
    return rows.some((row) => status(row.status) !== "CONNECTING") ? "reconnect" : "connect";
  }
  const live = await getUnipileAccount(connected.unipile_account_id.trim());
  if (!live.ok) return isUnipileAccountNotFound(live) ? "reconnect" : "ok";
  const features = (live.data as { connection_params?: { im?: { premiumFeatures?: unknown } } } | undefined)?.connection_params?.im
    ?.premiumFeatures;
  return !Array.isArray(features) || features.map(String).includes("sales_navigator") ? "ok" : "sales_navigator";
}
