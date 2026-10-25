import type { LinkedInProfileSnapshot } from "@/lib/apify/linkedinProfileTypes";
import { loadCoachLinkedInSummary } from "@/lib/firstCampaign/loadCoachContext";
import { normalizeLinkedInProfileUrl } from "@/lib/linkedin/normalizeProfileUrl";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getUnipileOwnProfile } from "@/lib/unipile/client";
import { hrefFromUnipileLinkedIn } from "@/lib/unipile/linkedinUrl";
import { resolveUnipileAccountIdForUser } from "@/lib/unipile/publishing";

import { seedPracticeFromLinkedIn } from "./ingestLinkedIn";
import { findPracticeKnowledge } from "./store";

/**
 * The coach's LinkedIn, for every writer that reads it. Uses the saved import
 * when there is one. Otherwise finds their LinkedIn address where we already
 * have it and imports it, so nobody is asked for what we could look up.
 */

export type CoachLinkedInUrl = { url: string; from: string };

export type CoachLinkedIn = {
  summary: string;
  snapshot: LinkedInProfileSnapshot | null;
  /** In plain words, what the writer used. Null when there is no LinkedIn. */
  used: string | null;
  /** The address we found but could not import, when that happened. */
  tried: CoachLinkedInUrl | null;
};

function hasSnapshot(snapshot: LinkedInProfileSnapshot | null): snapshot is LinkedInProfileSnapshot {
  return Boolean(snapshot && typeof snapshot === "object" && Object.keys(snapshot).length > 0);
}

function profileUrl(raw: unknown): string | null {
  return typeof raw === "string" && raw.trim() ? normalizeLinkedInProfileUrl(raw.trim()) : null;
}

/** Where a coach's LinkedIn address already is, best first: given, account, Blueprint, an earlier import, their connected LinkedIn. */
export async function findCoachLinkedInUrl(
  coachId: string,
  given?: string | null
): Promise<CoachLinkedInUrl | null> {
  const typed = profileUrl(given);
  if (typed) return { url: typed, from: "the address you gave" };

  const [{ data: profile }, knowledge, { data: imported }] = await Promise.all([
    supabaseAdmin.from("profiles").select("linkedin_url").eq("id", coachId).maybeSingle(),
    findPracticeKnowledge(coachId).catch(() => null),
    supabaseAdmin.from("coach_linkedin_profiles").select("linkedin_url").eq("coach_id", coachId).maybeSingle(),
  ]);
  const account = profileUrl(profile?.linkedin_url);
  if (account) return { url: account, from: "the LinkedIn address on their account" };
  const blueprint = profileUrl(knowledge?.payload.identity.linkedin_url?.value);
  if (blueprint) return { url: blueprint, from: "the LinkedIn address in their Blueprint" };
  const earlier = profileUrl(imported?.linkedin_url);
  if (earlier) return { url: earlier, from: "an earlier LinkedIn import" };

  const accountId = await resolveUnipileAccountIdForUser(coachId).catch(() => null);
  if (accountId) {
    const me = await getUnipileOwnProfile(accountId).catch(() => null);
    const data = me?.ok ? me.data : null;
    const url = data
      ? hrefFromUnipileLinkedIn(
          typeof data.profile_url === "string" ? data.profile_url : null,
          typeof data.public_identifier === "string" ? data.public_identifier : null
        )
      : null;
    const connected = profileUrl(url);
    if (connected) return { url: connected, from: "their connected LinkedIn" };
  }
  return null;
}

/**
 * The LinkedIn a writer should read. Imports it first (and fills the
 * Blueprint's LinkedIn answers from it) when we can find their address.
 */
export async function ensureCoachLinkedIn(
  coachId: string,
  opts?: { linkedinUrl?: string | null }
): Promise<CoachLinkedIn> {
  const current = await loadCoachLinkedInSummary(coachId);
  if (hasSnapshot(current.snapshot)) {
    return { ...current, used: "their saved LinkedIn import", tried: null };
  }
  const found = await findCoachLinkedInUrl(coachId, opts?.linkedinUrl);
  if (!found) return { ...current, snapshot: null, used: null, tried: null };

  await seedPracticeFromLinkedIn(coachId, { scrape: true, linkedinUrl: found.url });
  const after = await loadCoachLinkedInSummary(coachId);
  return hasSnapshot(after.snapshot)
    ? { ...after, used: `their LinkedIn, imported just now from ${found.from}`, tried: null }
    : { ...after, snapshot: null, used: null, tried: found };
}

/** One line for the model on what LinkedIn a writer had. */
export function linkedInNote(linkedin: CoachLinkedIn): string {
  if (linkedin.used) return `LinkedIn: ${linkedin.used}.`;
  if (linkedin.tried) {
    return `LinkedIn: found ${linkedin.tried.url} (${linkedin.tried.from}) but could not import it. Check the address with them.`;
  }
  return "LinkedIn: none found (no saved import, no LinkedIn address on their account or in their Blueprint, LinkedIn not connected). Ask for their LinkedIn address.";
}
