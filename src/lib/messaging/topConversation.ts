import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import { hubScopeKey } from "@/lib/getClients/hubKeys";
import { fetchThreadPage } from "@/lib/messaging/prefetchProspectOpen";

/**
 * The conversation at the top of the inbox last time, so a fresh load can ask
 * for its messages at the same time as the list. Only the id is stored.
 */
function storageKey(impersonatingCoachId?: string | null) {
  return `inbox-top-conversation:${hubScopeKey(impersonatingCoachId)}`;
}

export function rememberTopConversation(
  id: string | null | undefined,
  impersonatingCoachId?: string | null
): void {
  if (!id) return;
  try {
    localStorage.setItem(storageKey(impersonatingCoachId), id);
  } catch {
    /* storage can be blocked */
  }
}

export function recallTopConversation(
  impersonatingCoachId?: string | null
): string | null {
  try {
    return localStorage.getItem(storageKey(impersonatingCoachId));
  } catch {
    return null;
  }
}

/** Start loading a thread's first page; the inbox picks up the same request. */
export function prefetchTopThread(
  id: string | null | undefined,
  impersonatingCoachId?: string | null
): void {
  if (!id) return;
  void getCoachAuthHeaders(impersonatingCoachId)
    .then((headers) => (headers ? fetchThreadPage(id, headers, { peek: true }) : undefined))
    .catch(() => undefined);
}
