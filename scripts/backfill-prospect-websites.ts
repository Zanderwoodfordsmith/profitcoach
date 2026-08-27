/**
 * Backfill contacts.company_website from leadrocks_leads matches.
 * Prefers LeadRocks rows that actually have a company_website (Sales Nav
 * cache rows often match first but lack websites).
 *
 * Usage:
 *   npx tsx scripts/backfill-prospect-websites.ts --coach-slug adam-msw
 *   npx tsx scripts/backfill-prospect-websites.ts --coach-slug adam-msw --dry-run
 */

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const dryRun = process.argv.includes("--dry-run");

function argValue(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  if (i === -1 || i + 1 >= process.argv.length) return null;
  return process.argv[i + 1];
}

const coachSlug = argValue("--coach-slug")?.trim();
if (!coachSlug) {
  console.error(
    "Usage: npx tsx scripts/backfill-prospect-websites.ts --coach-slug adam-msw [--dry-run]"
  );
  process.exit(1);
}

type ContactRow = {
  id: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  business_name: string | null;
  linkedin_url: string | null;
  company_website: string | null;
};

type LeadRow = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  company_website: string | null;
  linkedin_url: string | null;
  raw: Record<string, unknown> | null;
};

async function main() {
  const { supabaseAdmin } = await import("../src/lib/supabaseAdmin");
  const { normalizeCompanyWebsiteUrl } = await import(
    "../src/lib/leadFinder/display"
  );
  const { fetchAllSupabasePages } = await import(
    "../src/lib/contactsSchemaSafeSelect"
  );
  const {
    normalizePublicLinkedInUrl,
    samePersonNameCompany,
    isObfuscatedLinkedInUrl,
  } = await import("../src/lib/salesNavigator/leadIdentity");

  const { data: coach, error: coachError } = await supabaseAdmin
    .from("coaches")
    .select("id, slug")
    .eq("slug", coachSlug)
    .maybeSingle();
  if (coachError || !coach?.id) {
    throw new Error(`Coach not found for slug ${coachSlug}`);
  }

  const { data: contacts, error } = await fetchAllSupabasePages(async (from, to) =>
    supabaseAdmin
      .from("contacts")
      .select(
        "id, full_name, first_name, last_name, business_name, linkedin_url, company_website"
      )
      .eq("coach_id", coach.id)
      .eq("type", "prospect")
      .order("created_at", { ascending: false })
      .range(from, to)
  );
  if (error) throw new Error(error.message);

  const missing = (contacts as ContactRow[]).filter(
    (c) => !c.company_website?.trim()
  );
  console.log(
    `Coach ${coachSlug}: ${contacts.length} prospects, ${missing.length} missing website`
  );
  if (dryRun) console.log("Mode: dry-run");

  // Index LeadRocks rows that have websites — name+company is the reliable key
  // when Sales Nav LinkedIn URLs are obfuscated.
  console.log("Loading LeadRocks rows with websites…");
  const { data: leadRows, error: leadError } = await fetchAllSupabasePages(
    async (from, to) =>
      supabaseAdmin
        .from("leadrocks_leads")
        .select(
          "id, full_name, first_name, last_name, company, company_website, linkedin_url, raw"
        )
        .not("company_website", "is", null)
        .neq("company_website", "")
        .order("id", { ascending: true })
        .range(from, to),
    1000,
    200_000
  );
  if (leadError) throw new Error(leadError.message);

  const leads = leadRows as LeadRow[];
  console.log(`LeadRocks with website: ${leads.length}`);

  const byCompany = new Map<string, LeadRow[]>();
  for (const lead of leads) {
    const company = lead.company?.trim().toLowerCase();
    if (!company) continue;
    const list = byCompany.get(company) ?? [];
    list.push(lead);
    byCompany.set(company, list);
  }

  function findWebsite(contact: ContactRow): string | null {
    const companyKey = contact.business_name?.trim().toLowerCase();
    const pool = companyKey ? byCompany.get(companyKey) ?? [] : [];
    const person = {
      firstName: contact.first_name,
      lastName: contact.last_name,
      fullName: contact.full_name,
      company: contact.business_name,
    };

    for (const lead of pool) {
      if (!samePersonNameCompany(person, lead)) continue;
      const website = normalizeCompanyWebsiteUrl(lead.company_website);
      if (website) return website;
    }

    // Vanity LinkedIn only — obfuscated Sales Nav URLs won't match LeadRocks CSV.
    if (
      contact.linkedin_url &&
      !isObfuscatedLinkedInUrl(contact.linkedin_url)
    ) {
      const li = normalizePublicLinkedInUrl(contact.linkedin_url);
      if (li) {
        for (const lead of leads) {
          const leadLi = normalizePublicLinkedInUrl(lead.linkedin_url);
          if (leadLi && leadLi === li) {
            return normalizeCompanyWebsiteUrl(lead.company_website);
          }
        }
      }
    }

    return null;
  }

  let updated = 0;
  let unmatched = 0;
  let failed = 0;

  for (let i = 0; i < missing.length; i += 1) {
    const c = missing[i];
    const website = findWebsite(c);
    if (!website) {
      unmatched += 1;
    } else if (dryRun) {
      updated += 1;
    } else {
      const { error: updateError } = await supabaseAdmin
        .from("contacts")
        .update({ company_website: website })
        .eq("id", c.id);
      if (updateError) {
        failed += 1;
        console.error(`Update failed for ${c.full_name}:`, updateError.message);
      } else {
        updated += 1;
      }
    }

    if ((i + 1) % 200 === 0 || i + 1 === missing.length) {
      process.stdout.write(
        `\rProcessed ${i + 1}/${missing.length} · updated ${updated}`
      );
    }
  }

  console.log(
    `\nDone. updated=${updated} unmatched=${unmatched} failed=${failed}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
