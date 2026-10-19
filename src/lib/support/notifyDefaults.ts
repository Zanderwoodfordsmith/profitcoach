import type { SupportTicketSource } from "@/lib/support/tickets";

/**
 * Whether replying emails the submitter by default. Kept apart from
 * notifyCoachOfReply (server mail code) so the admin support page can use it.
 */
export function supportNotifyDefaultOn(
  source: SupportTicketSource | string | null | undefined,
  memberNotifyEmail?: boolean | null
): boolean {
  if (memberNotifyEmail === false) return false;
  if (memberNotifyEmail === true) return true;
  return source === "email_inbox" || source === "public_form";
}
