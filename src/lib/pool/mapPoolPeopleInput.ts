import {
  displayListPersonName,
  isAudienceItemSource,
  MAX_POOL_ITEMS_PER_REQUEST,
  splitPersonName,
  type AudienceItemSource,
} from "@/lib/leadLists/audienceLists";
import { poolIdentityKey, type PoolRecordInput } from "@/lib/pool/identity";

function asTrimmed(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export function mapPoolPeopleInput(
  raw: unknown,
  source: AudienceItemSource,
  max = MAX_POOL_ITEMS_PER_REQUEST
): PoolRecordInput[] {
  if (!Array.isArray(raw)) return [];
  const records: PoolRecordInput[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const first = asTrimmed(row.first_name);
    const last = asTrimmed(row.last_name);
    const full = asTrimmed(row.full_name) ?? "";
    const split = !first && !last ? splitPersonName(full) : null;
    const first_name = first ?? split?.first_name ?? null;
    const last_name = last ?? split?.last_name ?? null;
    const record: PoolRecordInput = {
      source: isAudienceItemSource(String(row.source ?? ""))
        ? (row.source as AudienceItemSource)
        : source,
      full_name: displayListPersonName({
        full_name: full || null,
        first_name,
        last_name,
      }),
      first_name,
      last_name,
      job_title: asTrimmed(row.title) ?? asTrimmed(row.job_title),
      company: asTrimmed(row.company),
      linkedin_url: asTrimmed(row.linkedin_url),
      email: asTrimmed(row.email),
      phone: asTrimmed(row.phone),
      website: asTrimmed(row.website),
      place_id: asTrimmed(row.place_id),
    };
    const key = poolIdentityKey(record);
    if (key) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    records.push(record);
  }
  return records.slice(0, max);
}
