import {
  insertPeopleOnList,
  mapAudiencePeopleInput,
  recountLeadListItems,
  type AudienceListKind,
} from "@/lib/leadLists/audienceLists";
import type { SalesNavImportLeadSnapshot } from "@/lib/salesNavigator/importLeadSnapshot";
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
      .select("linkedin_url, team_size, industry, revenue_range, location")
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
}): Promise<{ added: number; skipped: number; blacklisted: number }> {
  const firmographics = await loadFirmographics(
    opts.snapshot.map((row) => row.linkedinUrl)
  );
  const people = mapAudiencePeopleInput(
    opts.snapshot.map((row) => {
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
      };
    }),
    "sales_nav",
    opts.snapshot.length
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
  await recountLeadListItems(opts.listId);
  return { added, skipped, blacklisted };
}
