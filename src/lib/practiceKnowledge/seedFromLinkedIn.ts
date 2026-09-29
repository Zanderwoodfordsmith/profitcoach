import type { LinkedInProfileSnapshot } from "@/lib/apify/linkedinProfileTypes";
import type { PracticeKnowledgePayload } from "./types";
import { sourced } from "./sourced";

function uniqueNonEmpty(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const v = raw?.trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

export function seedPayloadFromLinkedIn(
  snapshot: LinkedInProfileSnapshot | null,
  extras?: { linkedinUrl?: string | null; location?: string | null }
): Partial<PracticeKnowledgePayload> {
  const at = new Date().toISOString();
  const experiences = snapshot?.experiences ?? [];
  const roles = uniqueNonEmpty(experiences.map((e) => e.title));
  const industries = uniqueNonEmpty([
    ...experiences.map((e) => e.industry),
    ...experiences.map((e) => e.company),
  ]);
  const location = snapshot?.location?.trim() || extras?.location?.trim() || "";
  const linkedinUrl =
    snapshot?.linkedinUrl?.trim() || extras?.linkedinUrl?.trim() || "";

  return {
    identity: {
      phone: null,
      whatsapp: null,
      website: null,
      timezone: null,
      web_address: null,
      practice_email: null,
      linkedin_visibility: null,
      location: location ? sourced(location, "linkedin", at) : null,
      linkedin_url: linkedinUrl ? sourced(linkedinUrl, "linkedin", at) : null,
    },
    market: {
      industries_worked: industries.length
        ? sourced(industries.slice(0, 12), "linkedin", at)
        : null,
      roles_held: roles.length ? sourced(roles.slice(0, 12), "linkedin", at) : null,
      industries_understand: null,
      industries_credibility: null,
      industries_access: null,
      avoid: null,
      geography_pref: null,
      buyer_roles: null,
    },
  };
}
