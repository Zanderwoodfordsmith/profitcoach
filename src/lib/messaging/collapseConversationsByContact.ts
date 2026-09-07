import {
  normalizeContactEmail,
  normalizeContactLinkedInUrl,
  normalizeContactPhone,
} from "@/lib/contacts/identity";
import {
  linkedInIdentityKeys,
  linkedInProviderIdFromUrl,
  normalizeLinkedInProviderId,
} from "@/lib/contacts/linkedinIdentity";

/**
 * Inbox shows one row per person when multiple Unipile/channel threads
 * share the same contact_id — or the same phone / email / LinkedIn
 * (vanity + ACo… provider id looking like "two Pams").
 */

export type CollapsibleConversation = {
  id: string;
  contact_id?: string | null;
  last_message_at?: string | null;
  last_channel?: string | null;
  last_direction?: string | null;
  reply_channels?: string[];
  unipile_chat_id?: string | null;
  last_preview?: string | null;
  unread_count?: number | null;
  prospect_email?: string | null;
  prospect_phone?: string | null;
  prospect_linkedin_url?: string | null;
  prospect_linkedin_provider_id?: string | null;
};

function activityAt(row: CollapsibleConversation): number {
  if (!row.last_message_at) return 0;
  const t = new Date(row.last_message_at).getTime();
  return Number.isFinite(t) ? t : 0;
}

/** Prefer real provider threads over empty CRM shells when picking the survivor. */
function threadScore(row: CollapsibleConversation): number {
  let score = activityAt(row);
  if (row.unipile_chat_id) score += 1e15;
  if ((row.last_preview || "").trim()) score += 1e12;
  if ((row.unread_count || 0) > 0) score += 1e9;
  if (row.contact_id) score += 1e6;
  return score;
}

function identityKeys(row: CollapsibleConversation): string[] {
  const keys: string[] = [];
  const contactId = row.contact_id?.trim();
  if (contactId) keys.push(`contact:${contactId}`);
  const email = normalizeContactEmail(row.prospect_email);
  if (email) keys.push(`email:${email}`);
  const phone = normalizeContactPhone(row.prospect_phone);
  if (phone) keys.push(`phone:${phone}`);
  for (const key of linkedInIdentityKeys({
    linkedinUrl: row.prospect_linkedin_url,
    providerId:
      row.prospect_linkedin_provider_id ||
      linkedInProviderIdFromUrl(row.prospect_linkedin_url),
  })) {
    keys.push(key);
  }
  // Also keep exact URL key via normalize for legacy rows without provider id.
  const linkedin = normalizeContactLinkedInUrl(row.prospect_linkedin_url);
  if (linkedin && !keys.includes(`li:${linkedin}`)) {
    keys.push(`li:${linkedin}`);
  }
  const provider = normalizeLinkedInProviderId(
    row.prospect_linkedin_provider_id
  );
  if (provider && !keys.includes(`lip:${provider}`)) {
    keys.push(`lip:${provider}`);
  }
  return keys;
}

/**
 * Union-find style: threads that share any identity key collapse together.
 */
export function collapseConversationsByContact<T extends CollapsibleConversation>(
  rows: T[]
): Array<
  T & {
    thread_count: number;
    sibling_conversation_ids: string[];
  }
> {
  if (!rows.length) return [];

  const parent = new Map<string, string>();
  const find = (id: string): string => {
    let cur = id;
    while (parent.get(cur) && parent.get(cur) !== cur) {
      cur = parent.get(cur)!;
    }
    // Path compress
    let walk = id;
    while (walk !== cur) {
      const next = parent.get(walk)!;
      parent.set(walk, cur);
      walk = next;
    }
    return cur;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  for (const row of rows) {
    parent.set(row.id, row.id);
  }

  const keyOwner = new Map<string, string>();
  for (const row of rows) {
    for (const key of identityKeys(row)) {
      const existing = keyOwner.get(key);
      if (existing) union(row.id, existing);
      else keyOwner.set(key, row.id);
    }
  }

  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const root = find(row.id);
    const list = groups.get(root) ?? [];
    list.push(row);
    groups.set(root, list);
  }

  const collapsed: Array<
    T & { thread_count: number; sibling_conversation_ids: string[] }
  > = [];

  for (const group of groups.values()) {
    if (group.length === 1) {
      collapsed.push({
        ...group[0],
        thread_count: 1,
        sibling_conversation_ids: [],
      });
      continue;
    }

    const sorted = [...group].sort((a, b) => threadScore(b) - threadScore(a));
    const primary = sorted[0];
    const siblings = sorted.slice(1);
    const channels = new Set<string>();
    for (const row of sorted) {
      if (row.last_channel) channels.add(row.last_channel);
      for (const c of row.reply_channels ?? []) channels.add(c);
    }
    const unread = sorted.reduce(
      (n, row) => n + (Number(row.unread_count) || 0),
      0
    );

    // Prefer a linked contact_id on the primary row when a sibling has one.
    const contactId =
      primary.contact_id ||
      siblings.find((s) => s.contact_id)?.contact_id ||
      null;

    const providerId =
      primary.prospect_linkedin_provider_id ||
      siblings.find((s) => s.prospect_linkedin_provider_id)
        ?.prospect_linkedin_provider_id ||
      linkedInProviderIdFromUrl(primary.prospect_linkedin_url) ||
      null;

    collapsed.push({
      ...primary,
      contact_id: contactId,
      prospect_linkedin_provider_id: providerId,
      unread_count: unread,
      reply_channels: [...channels],
      thread_count: group.length,
      sibling_conversation_ids: siblings.map((s) => s.id),
    });
  }

  collapsed.sort((a, b) => activityAt(b) - activityAt(a));
  return collapsed;
}

/** Empty CRM shells: no Unipile chat and nothing to show. */
export function isShellConversation(row: {
  unipile_chat_id?: string | null;
  last_preview?: string | null;
  unread_count?: number | null;
}): boolean {
  if (row.unipile_chat_id) return false;
  if ((row.last_preview || "").trim()) return false;
  if ((row.unread_count || 0) > 0) return false;
  return true;
}
