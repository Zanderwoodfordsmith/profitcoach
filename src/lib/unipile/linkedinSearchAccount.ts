import {
  getUnipileAccount,
  isUnipileAccountNotFound,
  UNIPILE_LINKEDIN_RECONNECT_ERROR,
} from "@/lib/unipile/client";
import { getOkLinkedInAccount } from "@/lib/unipile/outreachAccounts";

export const CONNECT_LINKEDIN_SALES_NAV_ERROR =
  "Connect LinkedIn first. The connected account needs Sales Navigator.";

/** Live LinkedIn Unipile account id, or throw a coach-facing error. */
export async function requireLiveLinkedInUnipileAccount(
  coachId: string
): Promise<string> {
  const account = await getOkLinkedInAccount(coachId);
  const accountId = account?.unipile_account_id?.trim() || "";
  if (!accountId) {
    throw new Error(CONNECT_LINKEDIN_SALES_NAV_ERROR);
  }
  const live = await getUnipileAccount(accountId);
  if (!live.ok) {
    throw new Error(
      isUnipileAccountNotFound(live)
        ? UNIPILE_LINKEDIN_RECONNECT_ERROR
        : live.error || CONNECT_LINKEDIN_SALES_NAV_ERROR
    );
  }
  return accountId;
}
