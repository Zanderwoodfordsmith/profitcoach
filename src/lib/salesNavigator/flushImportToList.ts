import {
  insertPeopleOnList,
  mapAudiencePeopleInput,
  recountLeadListItems,
  type AudienceListKind,
} from "@/lib/leadLists/audienceLists";
import type { SalesNavImportLeadSnapshot } from "@/lib/salesNavigator/importLeadSnapshot";

function toChunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function flushSalesNavSnapshotToList(opts: {
  coachId: string;
  listId: string;
  kind: AudienceListKind;
  snapshot: SalesNavImportLeadSnapshot[];
}): Promise<{ added: number; skipped: number; blacklisted: number }> {
  const people = mapAudiencePeopleInput(
    opts.snapshot.map((row) => ({
      linkedin_url: row.linkedinUrl,
      first_name: row.firstName,
      last_name: row.lastName,
      full_name: row.fullName,
      company: row.company,
      title: row.jobTitle,
    })),
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
