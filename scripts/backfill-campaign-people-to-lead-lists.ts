/**
 * One-off (job 310): campaign people who are on no lead list go into the
 * coach's Pool and a "Sales Robot import" list, so Lead Lists can find them.
 * Only adds rows. Skips blacklisted people and people without a LinkedIn link.
 *
 *   npx tsx scripts/backfill-campaign-people-to-lead-lists.ts --dry-run
 *   npx tsx scripts/backfill-campaign-people-to-lead-lists.ts --coach-id <uuid>
 *   npx tsx scripts/backfill-campaign-people-to-lead-lists.ts --all
 */

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const LIST_NAME = "Sales Robot import";

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const onlyCoach = arg("--coach-id");
  if (!dryRun && !onlyCoach && !process.argv.includes("--all")) {
    throw new Error("Pass --dry-run, --coach-id <uuid> or --all.");
  }

  const { supabaseAdmin } = await import("../src/lib/supabaseAdmin");
  const { fetchAllSupabasePages } = await import(
    "../src/lib/contactsSchemaSafeSelect"
  );
  const { normalizeLinkedInProfileUrl } = await import(
    "../src/lib/unipile/linkedinUrl"
  );
  const {
    addCampaignPeopleToPool,
    copyMatchingPoolItemsOntoList,
    createCoachAudienceList,
    recountLeadListItems,
  } = await import("../src/lib/leadLists/audienceLists");

  type Lead = {
    id: string;
    coach_id: string;
    contact_id: string | null;
    linkedin_url: string | null;
    first_name: string | null;
    last_name: string | null;
    company: string | null;
    title: string | null;
  };
  const leadsPage = await fetchAllSupabasePages<Lead>(
    async (from, to) => {
      let q = supabaseAdmin
        .from("linkedin_campaign_leads")
        .select(
          "id, coach_id, contact_id, linkedin_url, first_name, last_name, company, title"
        )
        .order("id", { ascending: true });
      if (onlyCoach) q = q.eq("coach_id", onlyCoach);
      const r = await q.range(from, to);
      return { data: (r.data ?? null) as Lead[] | null, error: r.error };
    },
    1000,
    1_000_000
  );
  if (leadsPage.error) throw new Error(leadsPage.error.message);

  const byCoach = new Map<string, Lead[]>();
  for (const lead of leadsPage.data) {
    const arr = byCoach.get(lead.coach_id) ?? [];
    arr.push(lead);
    byCoach.set(lead.coach_id, arr);
  }

  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name")
    .in("id", [...byCoach.keys()]);
  const nameOf = new Map(
    (profiles ?? []).map((p) => [p.id as string, (p.full_name as string) ?? ""])
  );

  let totalAdded = 0;
  for (const [coachId, leads] of byCoach) {
    type Item = { linkedin_url: string | null; contact_id: string | null };
    const itemsPage = await fetchAllSupabasePages<Item>(
      async (from, to) => {
        const r = await supabaseAdmin
          .from("coach_lead_list_items")
          .select("linkedin_url, contact_id")
          .eq("coach_id", coachId)
          .order("id", { ascending: true })
          .range(from, to);
        return { data: (r.data ?? null) as Item[] | null, error: r.error };
      },
      1000,
      1_000_000
    );
    if (itemsPage.error) throw new Error(itemsPage.error.message);
    const listedUrls = new Set<string>();
    const listedContacts = new Set<string>();
    for (const item of itemsPage.data) {
      const url = normalizeLinkedInProfileUrl(String(item.linkedin_url ?? ""));
      if (url) listedUrls.add(url);
      if (item.contact_id) listedContacts.add(item.contact_id);
    }

    const missing = new Map<string, Lead>();
    let noLink = 0;
    for (const lead of leads) {
      const url = normalizeLinkedInProfileUrl(String(lead.linkedin_url ?? ""));
      if (!url) {
        if (!lead.contact_id || !listedContacts.has(lead.contact_id)) noLink += 1;
        continue;
      }
      if (listedUrls.has(url)) continue;
      if (lead.contact_id && listedContacts.has(lead.contact_id)) continue;
      if (!missing.has(url)) missing.set(url, { ...lead, linkedin_url: url });
    }

    const name = nameOf.get(coachId) || coachId;
    if (!missing.size) {
      if (noLink) console.log(`${name}: nothing to add (${noLink} without a LinkedIn link)`);
      continue;
    }
    if (dryRun) {
      console.log(
        `${name}: would add ${missing.size}` +
          (noLink ? ` (${noLink} without a LinkedIn link skipped)` : "")
      );
      totalAdded += missing.size;
      continue;
    }

    const people = [...missing.values()];
    let added = 0;
    const keys: string[] = [];
    for (let i = 0; i < people.length; i += 1000) {
      const r = await addCampaignPeopleToPool(coachId, people.slice(i, i + 1000));
      added += r.added;
      keys.push(...r.identityKeys);
    }

    const { data: existingList } = await supabaseAdmin
      .from("coach_lead_lists")
      .select("id")
      .eq("coach_id", coachId)
      .eq("kind", "audience")
      .eq("name", LIST_NAME)
      .maybeSingle();
    const listId =
      (existingList?.id as string | undefined) ??
      (await createCoachAudienceList({ coachId, name: LIST_NAME })).id;
    let onList = 0;
    for (let i = 0; i < keys.length; i += 1000) {
      const r = await copyMatchingPoolItemsOntoList({
        coachId,
        targetListId: listId,
        identityKeys: keys.slice(i, i + 1000),
      });
      onList += r.added;
    }
    const listCount = await recountLeadListItems(listId);
    console.log(
      `${name}: ${added} into Pool, ${onList} onto "${LIST_NAME}" (list now ${listCount})` +
        (noLink ? `, ${noLink} without a LinkedIn link skipped` : "")
    );
    totalAdded += added;
  }
  console.log(dryRun ? `Total would add: ${totalAdded}` : `Total added to Pools: ${totalAdded}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
