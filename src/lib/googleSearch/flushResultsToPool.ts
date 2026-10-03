import { insertPoolRecords } from "@/lib/googleMaps/flushPlacesToPool";
import { recountLeadListItems } from "@/lib/leadLists/audienceLists";
import type { MappedGoogleSearchResult } from "@/lib/googleSearch/mapResultsToPool";
import type { PoolRecordInput } from "@/lib/pool/identity";

export function mappedSearchResultToPoolRecord(
  result: MappedGoogleSearchResult
): PoolRecordInput {
  const lead = result.lead;
  return {
    source: "google_search",
    full_name: lead?.fullName ?? result.company,
    first_name: lead?.firstName ?? null,
    last_name: lead?.lastName ?? null,
    job_title: lead?.jobTitle ?? null,
    company: result.company,
    linkedin_url: lead?.linkedinUrl ?? null,
    email: lead?.email ?? null,
    phone: lead?.phone ?? null,
    website: result.website,
    match_reason: "Google Search",
    raw: {
      google_search: {
        url: result.website,
        host: result.host,
        title: result.title,
        description: result.description,
        query: result.query,
        position: result.position,
      },
    },
  };
}

export async function flushGoogleSearchResultsToPool(opts: {
  coachId: string;
  listId: string;
  results: MappedGoogleSearchResult[];
  cap: number;
}): Promise<{ added: number; skipped: number; peopleFound: number }> {
  const records = opts.results.map(mappedSearchResultToPoolRecord);
  const flushed = await insertPoolRecords({
    coachId: opts.coachId,
    listId: opts.listId,
    records,
    cap: opts.cap,
  });
  await recountLeadListItems(opts.listId);
  return {
    added: flushed.added,
    skipped: flushed.skipped,
    peopleFound: records.filter((row) => row.linkedin_url).length,
  };
}
