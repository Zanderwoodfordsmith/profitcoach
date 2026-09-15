import { displayNameFromProfile, type ProfileNames } from "@/lib/communityProfile";
import {
  BROADCAST_MENTION_LABEL,
  type BroadcastMentionGroup,
} from "@/lib/communityMentions";

export type MentionProfileRow = ProfileNames & {
  id: string;
  role?: string | null;
};

export type BroadcastMentionUser = {
  id: string;
  display_name: string;
  avatar_url: null;
  role: "group";
  broadcast: BroadcastMentionGroup;
};

const BROADCAST_MENTION_SEARCH: Record<BroadcastMentionGroup, string[]> = {
  everyone: ["everyone", "every", "everybody"],
  coaches: ["profit", "coach", "coaches", "profitcoaches", "profit-coaches"],
};

/** Picker rows for @everyone / @Profit Coaches (notify the whole community). */
export function broadcastMentionsForQuery(query: string): BroadcastMentionUser[] {
  const needle = query.trim().toLowerCase().replace(/\s+/g, "");
  return (Object.keys(BROADCAST_MENTION_LABEL) as BroadcastMentionGroup[])
    .filter((group) => broadcastMentionMatchesQuery(group, needle))
    .map((group) => ({
      id: `group:${group}`,
      display_name: BROADCAST_MENTION_LABEL[group],
      avatar_url: null,
      role: "group" as const,
      broadcast: group,
    }));
}

export function broadcastMentionMatchesQuery(
  group: BroadcastMentionGroup,
  needle: string
): boolean {
  if (!needle) return true;
  const label = BROADCAST_MENTION_LABEL[group].toLowerCase();
  const compact = label.replace(/\s+/g, "");
  if (label.startsWith(needle) || compact.startsWith(needle)) return true;
  return BROADCAST_MENTION_SEARCH[group].some((term) => term.startsWith(needle));
}

/** Default @-mention picker order when the query is empty (bare `@`). */
export const ADMIN_MENTION_FIRST_NAMES = ["Pam", "Zander"] as const;

export function adminMentionSortIndex(row: ProfileNames): number {
  const first = (row.first_name ?? "").trim().toLowerCase();
  const idx = ADMIN_MENTION_FIRST_NAMES.findIndex(
    (name) => name.toLowerCase() === first
  );
  return idx === -1 ? ADMIN_MENTION_FIRST_NAMES.length : idx;
}

export function compareAdminMentionOrder(a: ProfileNames, b: ProfileNames): number {
  const orderDiff = adminMentionSortIndex(a) - adminMentionSortIndex(b);
  if (orderDiff !== 0) return orderDiff;
  return displayNameFromProfile(a).localeCompare(displayNameFromProfile(b));
}

/** Put the post (or thread) author first in @-mention pickers when provided. */
export function comparePrioritizedMentionUser(
  a: { id: string },
  b: { id: string },
  prioritizeUserId: string | null | undefined
): number {
  if (!prioritizeUserId) return 0;
  const aPri = a.id === prioritizeUserId;
  const bPri = b.id === prioritizeUserId;
  if (aPri && !bPri) return -1;
  if (!aPri && bPri) return 1;
  return 0;
}

/**
 * Higher scores rank earlier. Slug and first-name prefix matches beat substring
 * matches inside a last name (e.g. "will" → Will Walsh before Charles Williams).
 */
export function mentionMatchScore(
  row: MentionProfileRow,
  slug: string | null | undefined,
  query: string
): number {
  const needle = query.trim().toLowerCase();
  if (!needle) return 0;

  const slugNorm = (slug ?? "").trim().toLowerCase();
  const name = displayNameFromProfile(row).toLowerCase();
  const first = (row.first_name ?? "").trim().toLowerCase();
  const last = (row.last_name ?? "").trim().toLowerCase();

  if (slugNorm === needle) return 1000;
  if (slugNorm.startsWith(needle)) return 900;
  if (first === needle) return 850;
  if (first.startsWith(needle)) return 800;

  const words = name.split(/\s+/).filter(Boolean);
  if (words.some((word) => word.startsWith(needle))) return 600;

  if (last.startsWith(needle)) return 400;
  if (name.includes(needle)) return 100;

  if (row.id.toLowerCase().startsWith(needle)) return 50;
  return 0;
}

export function compareMentionSearchResults(
  a: MentionProfileRow,
  b: MentionProfileRow,
  slugByCoach: Record<string, string>,
  needle: string,
  prioritizeUserId?: string | null
): number {
  const prioritized = comparePrioritizedMentionUser(a, b, prioritizeUserId);
  if (prioritized !== 0) return prioritized;

  const scoreDiff =
    mentionMatchScore(b, slugByCoach[b.id], needle) -
    mentionMatchScore(a, slugByCoach[a.id], needle);
  if (scoreDiff !== 0) return scoreDiff;

  return displayNameFromProfile(a).localeCompare(displayNameFromProfile(b));
}
