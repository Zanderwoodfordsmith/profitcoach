import { normalizeUnipileProvider } from "@/lib/unipile/providers";

export type MailingReconnectAccount = {
  provider: string | null;
  status: string | null;
  unipile_account_id: string | null;
};

/**
 * Which Unipile account a Google/Outlook connect should upgrade.
 * Calendar approval has to land on the mailbox that is already connected.
 * A fresh connect leaves the mail-only account in place, so the calendar
 * stays empty and booking invites never go out.
 */
export function pickMailingReconnectAccountId(
  accounts: MailingReconnectAccount[],
  provider: string,
  options?: { upgradeConnected?: boolean }
): string | null {
  const wanted = normalizeUnipileProvider(provider);
  const rows = accounts.filter((row) => {
    if (normalizeUnipileProvider(row.provider) !== wanted) return false;
    return Boolean(row.unipile_account_id?.trim());
  });
  const statusOf = (row: MailingReconnectAccount) =>
    (row.status || "").toUpperCase();

  if (options?.upgradeConnected) {
    const connected = rows.find((row) => statusOf(row) === "OK");
    const id = connected?.unipile_account_id?.trim();
    if (id) return id;
  }

  const stale = rows.find((row) => {
    const status = statusOf(row);
    return status !== "OK" && status !== "CONNECTING";
  });
  return stale?.unipile_account_id?.trim() || null;
}
