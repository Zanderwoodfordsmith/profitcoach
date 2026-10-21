/**
 * Carries a half-written community post, comment or reply across the jump from
 * "view as coach" (/coach/community) to the admin's own view (/admin/community),
 * so switching who you post as does not lose the text.
 */

const KEY = "community_draft_handoff";
const MAX_AGE_MS = 2 * 60 * 1000;

export type CommunityDraftHandoff =
  | { kind: "post"; title: string; body: string }
  | { kind: "comment"; postId: string; body: string }
  | { kind: "reply"; postId: string; replyTo: string; body: string };

export function saveCommunityDraftHandoff(draft: CommunityDraftHandoff) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...draft, savedAt: Date.now() }));
  } catch {
    // ignore
  }
}

/**
 * Read without clearing, so it is safe in useState initialisers. Only admin
 * pages pick it up: the coach page re-renders when view-as clears, just before
 * the jump, and must not swallow the draft.
 */
export function peekCommunityDraftHandoff(
  pathname: string | null
): CommunityDraftHandoff | null {
  if (typeof window === "undefined") return null;
  if (!pathname?.startsWith("/admin/")) return null;
  try {
    const parsed = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as
      | (CommunityDraftHandoff & { savedAt?: number })
      | null;
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearCommunityDraftHandoff() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
