import {
  insertPeopleOnList,
  mapAudiencePeopleInput,
  recountLeadListItems,
  type AudienceListKind,
} from "@/lib/leadLists/audienceLists";
import type { SalesNavImportLeadSnapshot } from "@/lib/salesNavigator/importLeadSnapshot";
import { rankSalesNavSnapshot } from "@/lib/salesNavigator/importJob";
import { canonicalLinkedInProfileUrl } from "@/lib/salesNavigator/linkedinUrl";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function toChunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

type CachedFirmographics = {
  team_size: string | null;
  industry: string | null;
  revenue_range: string | null;
  location: string | null;
  open_profile: boolean | null;
  linkedin_premium: boolean | null;
};

function asText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

/** Headcount lives on the lead cache (stamped from the search), not the snapshot. */
async function loadFirmographics(
  urls: Array<string | null>
): Promise<Map<string, CachedFirmographics>> {
  const keys = [
    ...new Set(
      urls
        .map((url) => canonicalLinkedInProfileUrl(url))
        .filter((url): url is string => Boolean(url))
    ),
  ];
  const out = new Map<string, CachedFirmographics>();
  for (const chunk of toChunks(keys, 40)) {
    const { data, error } = await supabaseAdmin
      .from("leadrocks_leads")
      .select(
        "linkedin_url, team_size, industry, revenue_range, location, open_profile, linkedin_premium"
      )
      .in("linkedin_url", chunk);
    if (error || !data) continue;
    for (const row of data) {
      const key = canonicalLinkedInProfileUrl(String(row.linkedin_url ?? ""));
      if (!key || out.has(key)) continue;
      out.set(key, {
        team_size: asText(row.team_size),
        industry: asText(row.industry),
        revenue_range: asText(row.revenue_range),
        location: asText(row.location),
        open_profile: row.open_profile === true ? true : row.open_profile === false ? false : null,
        linkedin_premium:
          row.linkedin_premium === true
            ? true
            : row.linkedin_premium === false
              ? false
              : null,
      });
    }
  }
  return out;
}

export async function flushSalesNavSnapshotToList(opts: {
  coachId: string;
  listId: string;
  kind: AudienceListKind;
  snapshot: SalesNavImportLeadSnapshot[];
  /** When the import started. Newer imports sort ahead of older ones. */
  rankedAt: string;
}): Promise<{ added: number; skipped: number; blacklisted: number }> {
  const ranked = rankSalesNavSnapshot(opts.snapshot);
  const firmographics = await loadFirmographics(
    ranked.map((row) => row.linkedinUrl)
  );
  const people = mapAudiencePeopleInput(
    ranked.map((row) => {
      const cached = firmographics.get(
        canonicalLinkedInProfileUrl(row.linkedinUrl) ?? ""
      );
      return {
        linkedin_url: row.linkedinUrl,
        first_name: row.firstName,
        last_name: row.lastName,
        full_name: row.fullName,
        company: row.company,
        title: row.jobTitle,
        team_size: cached?.team_size ?? null,
        industry: cached?.industry ?? null,
        revenue_range: cached?.revenue_range ?? null,
        location: row.location ?? cached?.location ?? null,
        open_profile: row.openProfile ?? cached?.open_profile ?? null,
        linkedin_premium: row.premium,
      };
    }),
    "sales_nav",
    ranked.length
  );

  let added = 0;
  let skipped = 0;
  let blacklisted = 0;
  for (const chunk of toChunks(people, 250)) {
    const result = await insertPeopleOnList({
      coachId: opts.coachId,
      listId: opts.listId,
      kind: opts.kind,
      people: chunk,
    });
    added += result.added;
    skipped += result.skipped;
    blacklisted += result.blacklisted;
  }
  await stampSalesNavRanks({
    listId: opts.listId,
    identityKeys: people.map((person) => `li:${person.linkedin_url}`),
    rankedAt: opts.rankedAt,
  });
  await recountLeadListItems(opts.listId);
  return { added, skipped, blacklisted };
}

/**
 * Record each person's Sales Nav position on the list, including people who
 * were already there. The pool and campaign adds use this instead of A-Z.
 */
async function stampSalesNavRanks(opts: {
  listId: string;
  identityKeys: string[];
  rankedAt: string;
}) {
  const chunks = toChunks(opts.identityKeys, 1000);
  for (let i = 0; i < chunks.length; i += 1) {
    const { error } = await supabaseAdmin.rpc("stamp_lead_list_item_ranks", {
      p_list_id: opts.listId,
      p_identity_keys: chunks[i],
      p_ranked_at: opts.rankedAt,
      p_rank_offset: i * 1000,
    });
    // Order is a nice-to-have; never fail the import over it.
    if (error) {
      console.error("stamp_lead_list_item_ranks:", error.message);
      return;
    }
  }
}
