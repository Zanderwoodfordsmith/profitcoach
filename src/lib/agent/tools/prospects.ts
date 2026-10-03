import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { blocksToMarkdown, sanitizeBuiltSections } from "@/lib/practiceKnowledge/blocks";
import {
  defaultCompanyKeywords,
  defaultJobTitleKeywords,
} from "@/lib/salesNavigator/baseSearchDefaults";
import {
  buildSalesNavSearchUrl,
  type SalesNavDegree,
  type SalesNavKeyword,
} from "@/lib/salesNavigator/buildSalesNavSearchUrl";
import { SALES_NAV_HEADCOUNT_BANDS } from "@/lib/salesNavigator/headcountBands";
import { isSalesNavSearchUrl } from "@/lib/salesNavigator/isSalesNavSearchUrl";
import { BASE_SEARCH_TEAM_SIZES } from "@/lib/salesNavigator/prospectSearch/applyStrategy";
import {
  resolveSalesNavRegion,
  SALES_NAV_REGION_CATALOG,
} from "@/lib/salesNavigator/regions";
import { SALES_NAV_POOL_LIMIT_OPTIONS } from "@/lib/salesNavigator/importSizing";
import { startSalesNavImport } from "@/lib/salesNavigator/startImport";
import { loadImportJob, syncSalesNavImportJob } from "@/lib/salesNavigator/importJob";
import {
  estimateGoogleMapsSearchCostUsd,
  formatGoogleMapsApproxDuration,
  GOOGLE_MAPS_SIZE_OPTIONS,
} from "@/lib/googleMaps/cost";
import {
  GOOGLE_MAPS_COUNTRIES,
  GOOGLE_MAPS_US_STATES,
} from "@/lib/googleMaps/location";
import {
  planGoogleMapsImport,
  startGoogleMapsImport,
  type GoogleMapsImportRequest,
} from "@/lib/googleMaps/startImport";
import {
  loadGoogleMapsImportJob,
  syncGoogleMapsImportJob,
} from "@/lib/googleMaps/importJob";
import {
  planGoogleSearchImport,
  startGoogleSearchImport,
  type GoogleSearchImportRequest,
} from "@/lib/googleSearch/startImport";
import {
  estimateGoogleSearchCostUsd,
  formatGoogleSearchApproxDuration,
  GOOGLE_SEARCH_SIZE_OPTIONS,
} from "@/lib/googleSearch/cost";
import {
  loadGoogleSearchImportJob,
  syncGoogleSearchImportJob,
} from "@/lib/googleSearch/importJob";
import { getOkLinkedInAccount } from "@/lib/unipile/outreachAccounts";

import type { AgentToolContext, AgentToolDef, AgentToolInput } from "../types";
import { AgentToolError, coachOf, num, plural, str, strList } from "./util";

/** Sales Navigator search building, imports from Sales Navigator and Google Maps. */

const DEGREES: SalesNavDegree[] = ["1", "2", "3"];
const TEAM_SIZE_LABELS = SALES_NAV_HEADCOUNT_BANDS.map((band) => band.label);

function regionNames(): string[] {
  return [...new Set(SALES_NAV_REGION_CATALOG.map((region) => region.text))];
}

function dedupeKeywords(keywords: SalesNavKeyword[]): SalesNavKeyword[] {
  const map = new Map<string, SalesNavKeyword>();
  for (const keyword of keywords) map.set(keyword.term.toLowerCase(), keyword);
  return [...map.values()];
}

export type SalesNavCriteria = {
  location: string;
  companyIncludes: string[];
  companyExcludesExtra: string[];
  keywords: string;
  titleIncludesExtra: string[];
  teamSizes: string[];
  degrees: SalesNavDegree[];
};

export function salesNavCriteriaFromInput(input: AgentToolInput): SalesNavCriteria {
  const teamSizes = strList(input, "team_sizes").filter((size) =>
    TEAM_SIZE_LABELS.includes(size)
  );
  const degrees = strList(input, "degrees").filter((d): d is SalesNavDegree =>
    DEGREES.includes(d as SalesNavDegree)
  );
  return {
    location: str(input, "location"),
    companyIncludes: strList(input, "company_includes"),
    companyExcludesExtra: strList(input, "company_excludes_extra"),
    keywords: str(input, "keywords"),
    titleIncludesExtra: strList(input, "title_includes_extra"),
    teamSizes: teamSizes.length ? teamSizes : [...BASE_SEARCH_TEAM_SIZES],
    degrees: degrees.length ? degrees : ["2", "3"],
  };
}

/** The classroom base search plus the narrowing the agent chose. */
export function buildSalesNavSearch(
  criteria: SalesNavCriteria
): { url: string; region: string } | { error: string } {
  if (!criteria.location) return { error: "Give a location, for example United Kingdom." };
  const region = resolveSalesNavRegion(criteria.location);
  if (!region) {
    return {
      error: `"${criteria.location}" is not in the Sales Navigator region list. Use one of: ${regionNames().join("; ")}. Or ask them to build the search in Sales Navigator and paste the URL.`,
    };
  }
  if (criteria.companyIncludes.length && criteria.keywords) {
    return {
      error:
        "Use company-name terms or keywords, not both (the playbook's rule). Make two searches if you want to try both.",
    };
  }
  const companyKeywords = dedupeKeywords([
    ...defaultCompanyKeywords(),
    ...criteria.companyExcludesExtra.map((term) => ({ term, mode: "exclude" as const })),
    ...criteria.companyIncludes.map((term) => ({ term, mode: "include" as const })),
  ]);
  const titleKeywords = dedupeKeywords([
    ...defaultJobTitleKeywords(),
    ...criteria.titleIncludesExtra.map((term) => ({ term, mode: "include" as const })),
  ]);
  const url = buildSalesNavSearchUrl({
    titleKeywords,
    companyKeywords,
    teamSizes: criteria.teamSizes,
    location: criteria.location,
    // 1st-degree searches cover the whole network, so no region filter.
    degrees: criteria.degrees,
    keywordsBoolean: criteria.keywords || null,
  });
  return { url, region: region.text };
}

/**
 * Snap a requested size to the import options. Omitted means 1,000; 0 means
 * everything. Returns null for everything (LinkedIn caps it at 2,500).
 */
export function salesNavPoolLimitFor(requested: number | null): number | null {
  if (requested == null || requested < 0) return 1_000;
  if (requested === 0) return null;
  const option = SALES_NAV_POOL_LIMIT_OPTIONS.find((size) => size >= requested);
  return option ?? null;
}

function mapsRequestFrom(input: AgentToolInput): GoogleMapsImportRequest {
  return {
    searchTerms: strList(input, "search_terms", 5),
    countryCode: str(input, "country_code").toUpperCase() || undefined,
    countryName: str(input, "country_name") || undefined,
    stateCode: str(input, "state_code").toUpperCase() || undefined,
    city: str(input, "city") || undefined,
    maxPlaces: num(input, "max_places") ?? undefined,
    saveListName: str(input, "list_name") || undefined,
  };
}

async function runningMapsImport(coachId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("google_maps_import_runs")
    .select("id")
    .eq("coach_id", coachId)
    .in("status", ["pending", "running"])
    .limit(1);
  return Boolean(data?.length);
}

function searchRequestFrom(input: AgentToolInput): GoogleSearchImportRequest {
  const maps = mapsRequestFrom(input);
  return {
    ...maps,
    maxResults: maps.maxPlaces,
  };
}

async function runningSearchImport(coachId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("google_search_import_runs")
    .select("id")
    .eq("coach_id", coachId)
    .in("status", ["pending", "running"])
    .limit(1);
  return Boolean(data?.length);
}

async function runningSalesNavImport(coachId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("sales_nav_import_runs")
    .select("id")
    .eq("coach_id", coachId)
    .in("status", ["pending", "running"])
    .limit(1);
  return Boolean(data?.length);
}

async function latestJobId(
  table:
    | "google_maps_import_runs"
    | "google_search_import_runs"
    | "sales_nav_import_runs",
  coachId: string
): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from(table)
    .select("id")
    .eq("coach_id", coachId)
    .order("created_at", { ascending: false })
    .limit(1);
  return (data?.[0]?.id as string | undefined) ?? null;
}

async function listName(listId: string | null): Promise<string | null> {
  if (!listId) return null;
  const { data } = await supabaseAdmin
    .from("coach_lead_lists")
    .select("name, item_count")
    .eq("id", listId)
    .maybeSingle();
  return data ? `${data.name} (${plural(Number(data.item_count ?? 0), "person", "people")})` : null;
}

function sectionText(built: ReturnType<typeof sanitizeBuiltSections>, key: string): string | null {
  const section = built[key];
  if (!section?.blocks?.length) return null;
  const text = blocksToMarkdown(section.blocks);
  return text.length > 4_000 ? `${text.slice(0, 4_000)}\n[Truncated.]` : text;
}

export const prospectTools: AgentToolDef[] = [
  {
    name: "get_blueprint_targeting",
    label: "Reading the blueprint",
    needsCoach: true,
    description:
      "The targeting from the active coach's Practice Blueprint: prospect criteria, the avatar and the ideal client from their AI brain. Empty fields mean it has not been written yet.",
    input_schema: { type: "object", properties: {} },
    run: async (_input, ctx) => {
      const coach = coachOf(ctx);
      const [{ data: practice }, { data: profile }] = await Promise.all([
        supabaseAdmin
          .from("coach_practice_knowledge")
          .select("built_sections")
          .eq("coach_id", coach.id)
          .maybeSingle(),
        supabaseAdmin.from("profiles").select("ai_context, location").eq("id", coach.id).maybeSingle(),
      ]);
      const built = sanitizeBuiltSections(practice?.built_sections ?? {});
      const brain = (profile?.ai_context ?? {}) as Record<string, unknown>;
      return {
        coach_location: profile?.location ?? null,
        prospect_criteria: sectionText(built, "market:criteria"),
        avatar: sectionText(built, "market:avatar"),
        ideal_client: typeof brain.ideal_client === "string" ? brain.ideal_client.slice(0, 2_000) : null,
      };
    },
  },
  {
    name: "build_sales_nav_search",
    label: "Building the search",
    description:
      "Build a Sales Navigator people-search URL. The classroom base search is always applied: owner, founder, CEO and managing director titles; coach, consultant and recruiter excluded on title and company. You add the narrowing. Use company_includes OR keywords, never both.",
    input_schema: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: 'One region, e.g. "United Kingdom", "Yorkshire", "California, United States"',
        },
        company_includes: {
          type: "array",
          items: { type: "string" },
          description: 'Company-name terms with variations, e.g. ["engineering","engineers","engineer"]. Quote phrases: "\\"law firm\\""',
        },
        company_excludes_extra: {
          type: "array",
          items: { type: "string" },
          description: "Extra company-name words to exclude, beyond the base exclusions",
        },
        keywords: {
          type: "string",
          description: 'Keywords bar boolean, only when company names do not work: spirits AND (whisky OR gin)',
        },
        title_includes_extra: {
          type: "array",
          items: { type: "string" },
          description: 'Extra job titles to include, e.g. ["Principal","Head Architect"]',
        },
        team_sizes: {
          type: "array",
          items: { type: "string", enum: TEAM_SIZE_LABELS },
          description: "Company headcount bands. Default 1-10, 11-50, 51-200",
        },
        degrees: {
          type: "array",
          items: { type: "string", enum: DEGREES },
          description: 'Connection degrees. Default ["2","3"] for connector campaigns; ["1"] for their own connections',
        },
      },
      required: ["location"],
    },
    run: async (input) => {
      const criteria = salesNavCriteriaFromInput(input);
      const built = buildSalesNavSearch(criteria);
      if ("error" in built) throw new AgentToolError(built.error);
      return {
        url: built.url,
        region: built.region,
        criteria: {
          location: built.region,
          company_includes: criteria.companyIncludes,
          company_excludes_extra: criteria.companyExcludesExtra,
          keywords: criteria.keywords || null,
          extra_titles: criteria.titleIncludesExtra,
          team_sizes: criteria.teamSizes,
          degrees: criteria.degrees,
        },
        note: "Base search applied. Share the link so they can spot-check in Sales Navigator.",
        _link: { href: built.url, label: "Open the search in Sales Navigator" },
      };
    },
  },
  {
    name: "start_sales_nav_import",
    label: "Starting the Sales Navigator import",
    needsCoach: true,
    description:
      "Import people from a Sales Navigator people-search URL into a new list in the coach's pool, using their connected LinkedIn account. Asks for confirmation.",
    input_schema: {
      type: "object",
      properties: {
        sales_nav_url: { type: "string", description: "A linkedin.com/sales/search/people URL" },
        search_summary: {
          type: "string",
          description: 'One line for the card, e.g. "Owners of UK engineering firms, 1 to 200 staff"',
        },
        max_people: {
          type: "number",
          description: "How many people: 100, 250, 500, 1000 or 2500. Omit for 1,000. Use 0 for all (up to 2,500)",
        },
        list_name: { type: "string", description: "Name for the new list" },
      },
      required: ["sales_nav_url", "list_name"],
    },
    gate: async (input, ctx) => {
      const coach = coachOf(ctx);
      const url = str(input, "sales_nav_url");
      if (!isSalesNavSearchUrl(url)) {
        return { error: "That is not a Sales Navigator people-search URL." };
      }
      const linkedIn = await getOkLinkedInAccount(coach.id).catch(() => null);
      if (!linkedIn) {
        return {
          error: `${coach.name} has no connected LinkedIn account. They need to connect LinkedIn (with Sales Navigator) on the Campaigns page first.`,
        };
      }
      const limit = salesNavPoolLimitFor(num(input, "max_people"));
      const running = await runningSalesNavImport(coach.id);
      return {
        confirm: true,
        title: `Import from Sales Navigator for ${coach.name}`,
        details: [
          { label: "Search", value: str(input, "search_summary") || "Sales Navigator people search" },
          { label: "How many", value: limit ? `Up to ${limit.toLocaleString("en-GB")} people` : "Everyone (up to 2,500)" },
          { label: "Saved to list", value: str(input, "list_name") },
          { label: "Runs on", value: `${linkedIn.display_name ?? "their"} LinkedIn account, a few minutes` },
        ],
        warning: running
          ? "A Sales Navigator import is already running. Starting this one stops it."
          : undefined,
      };
    },
    run: async (input, ctx) => {
      const coach = coachOf(ctx);
      const limit = salesNavPoolLimitFor(num(input, "max_people"));
      const { job, saveList } = await startSalesNavImport(coach.id, {
        salesNavUrl: str(input, "sales_nav_url"),
        poolLimit: limit ?? undefined,
        saveListName: str(input, "list_name"),
      });
      return {
        job_id: job.jobId,
        kind: "sales_nav",
        list_id: saveList.id,
        list_name: saveList.name,
        target: job.targetCount,
      };
    },
  },
  {
    name: "google_maps_options",
    label: "Checking Google Maps options",
    description:
      "Supported countries, US states, and the size options with rough cost and time for a Google Maps import.",
    input_schema: { type: "object", properties: {} },
    run: async () => ({
      countries: GOOGLE_MAPS_COUNTRIES.map((c) => ({ code: c.code, name: c.label })),
      other_country: 'Any other country: country_code "OTHER" plus country_name.',
      us_states: GOOGLE_MAPS_US_STATES.map((s) => ({ code: s.code, name: s.label })),
      sizes: GOOGLE_MAPS_SIZE_OPTIONS.map((size) => ({
        businesses: size,
        up_to_usd: estimateGoogleMapsSearchCostUsd({ maxPlaces: size, findPeople: true }),
        takes: formatGoogleMapsApproxDuration(size),
      })),
    }),
  },
  {
    name: "start_google_maps_import",
    label: "Starting the Google Maps import",
    needsCoach: true,
    description:
      "Search Google Maps for businesses in a place, find the owners, and save them to a new list. Asks for confirmation with the cost.",
    input_schema: {
      type: "object",
      properties: {
        search_terms: {
          type: "array",
          items: { type: "string" },
          description: 'One to five terms a customer would type: ["plumbers","plumbing and heating"]',
        },
        country_code: { type: "string", description: 'ISO code from google_maps_options, or "OTHER"' },
        country_name: { type: "string", description: 'Only with country_code "OTHER"' },
        state_code: { type: "string", description: "US only: two-letter state code" },
        city: { type: "string", description: "Town, city or county. Leave out for the whole country or state" },
        max_places: { type: "number", description: "How many businesses: 20, 50, 100, 250, 500 or 1000" },
        list_name: { type: "string", description: "Name for the new list" },
      },
      required: ["search_terms", "country_code", "max_places"],
    },
    gate: async (input, ctx) => {
      const coach = coachOf(ctx);
      const plan = planGoogleMapsImport(mapsRequestFrom(input));
      if ("error" in plan) return { error: plan.error };
      if (await runningMapsImport(coach.id)) {
        return { error: `A Google Maps import is already running for ${coach.name}. Check it with check_import, then start the next one.` };
      }
      return {
        confirm: true,
        title: `Find ${plan.searchTerms.join(", ")} in ${plan.location.locationQuery}`,
        details: [
          { label: "For", value: coach.name },
          { label: "Search", value: plan.searchTerms.join(", ") },
          { label: "Where", value: plan.location.locationQuery },
          { label: "How many", value: `Up to ${plan.maxPlaces.toLocaleString("en-GB")} businesses` },
          { label: "Cost", value: `Up to $${plan.estimatedCostUsd.toFixed(2)}` },
          { label: "Takes", value: `About ${plan.approxDuration}` },
          { label: "Saved to list", value: plan.saveListName },
        ],
      };
    },
    run: async (input, ctx) => {
      const coach = coachOf(ctx);
      const plan = planGoogleMapsImport(mapsRequestFrom(input));
      if ("error" in plan) throw new AgentToolError(plan.error);
      const started = await startGoogleMapsImport(coach.id, plan);
      return {
        job_id: started.jobId,
        kind: "google_maps",
        list_id: started.saveListId,
        list_name: started.saveListName,
        target: started.targetCount,
        cost_up_to_usd: started.estimatedCostUsd,
      };
    },
  },
  {
    name: "google_search_options",
    label: "Checking Google Search options",
    description:
      "Supported countries, US states, and the size options with rough cost and time for a Google Search import.",
    input_schema: { type: "object", properties: {} },
    run: async () => ({
      countries: GOOGLE_MAPS_COUNTRIES.map((c) => ({ code: c.code, name: c.label })),
      other_country: 'Any other country: country_code "OTHER" plus country_name.',
      us_states: GOOGLE_MAPS_US_STATES.map((s) => ({ code: s.code, name: s.label })),
      sizes: GOOGLE_SEARCH_SIZE_OPTIONS.map((size) => ({
        businesses: size,
        up_to_usd: estimateGoogleSearchCostUsd({
          maxResults: size,
          queryCount: 1,
          findPeople: true,
        }),
        takes: formatGoogleSearchApproxDuration(size),
      })),
    }),
  },
  {
    name: "start_google_search_import",
    label: "Starting the Google Search import",
    needsCoach: true,
    description:
      "Search Google (not Maps) for businesses in a place, find a person at each, and save them to a new list. Asks for confirmation with the cost.",
    input_schema: {
      type: "object",
      properties: {
        search_terms: {
          type: "array",
          items: { type: "string" },
          description: 'One to five terms a customer would type into Google: ["plumbers","emergency plumber"]',
        },
        country_code: { type: "string", description: 'ISO code from google_search_options, or "OTHER"' },
        country_name: { type: "string", description: 'Only with country_code "OTHER"' },
        state_code: { type: "string", description: "US only: two-letter state code" },
        city: { type: "string", description: "Town, city or county. Leave out for the whole country or state" },
        max_places: { type: "number", description: "How many businesses: 20, 50, 100, 250, 500 or 1000" },
        list_name: { type: "string", description: "Name for the new list" },
      },
      required: ["search_terms", "country_code", "max_places"],
    },
    gate: async (input, ctx) => {
      const coach = coachOf(ctx);
      const plan = planGoogleSearchImport(searchRequestFrom(input));
      if ("error" in plan) return { error: plan.error };
      if (await runningSearchImport(coach.id)) {
        return { error: `A Google Search import is already running for ${coach.name}. Check it with check_import, then start the next one.` };
      }
      return {
        confirm: true,
        title: `Find ${plan.searchTerms.join(", ")} in ${plan.location.locationQuery}`,
        details: [
          { label: "For", value: coach.name },
          { label: "Search", value: plan.queries.join(" · ") },
          { label: "Where", value: plan.location.locationQuery },
          { label: "How many", value: `Up to ${plan.maxResults.toLocaleString("en-GB")} businesses` },
          { label: "Cost", value: `Up to $${plan.estimatedCostUsd.toFixed(2)}` },
          { label: "Takes", value: `About ${plan.approxDuration}` },
          { label: "Saved to list", value: plan.saveListName },
        ],
      };
    },
    run: async (input, ctx) => {
      const coach = coachOf(ctx);
      const plan = planGoogleSearchImport(searchRequestFrom(input));
      if ("error" in plan) throw new AgentToolError(plan.error);
      const started = await startGoogleSearchImport(coach.id, plan);
      return {
        job_id: started.jobId,
        kind: "google_search",
        list_id: started.saveListId,
        list_name: started.saveListName,
        target: started.targetCount,
        cost_up_to_usd: started.estimatedCostUsd,
      };
    },
  },
  {
    name: "check_import",
    label: "Checking the import",
    needsCoach: true,
    description:
      "Progress of a Sales Navigator, Google Maps, or Google Search import. Leave out job_id for the most recent one of that kind.",
    input_schema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["sales_nav", "google_maps", "google_search"] },
        job_id: { type: "string" },
      },
      required: ["kind"],
    },
    run: async (input, ctx: AgentToolContext) => {
      const coach = coachOf(ctx);
      const requested = str(input, "kind");
      const kind =
        requested === "google_maps" || requested === "google_search"
          ? requested
          : "sales_nav";
      const table =
        kind === "google_maps"
          ? "google_maps_import_runs"
          : kind === "google_search"
            ? "google_search_import_runs"
            : "sales_nav_import_runs";
      const jobId = str(input, "job_id") || (await latestJobId(table, coach.id));
      if (!jobId) throw new AgentToolError("No imports of that kind yet.");

      if (kind === "google_search") {
        let job = await loadGoogleSearchImportJob(jobId);
        if (!job || job.coach_id !== coach.id) throw new AgentToolError("Import not found.");
        if (job.status === "pending" || job.status === "running") {
          job = await syncGoogleSearchImportJob(job.id).catch(() => job!);
        }
        return {
          kind,
          status: job.status,
          businesses_found: job.progress_count,
          target: job.max_results,
          added_to_list: job.added_count,
          people_found: job.people_found,
          list: await listName(job.save_list_id),
          error: job.error_message,
        };
      }

      if (kind === "google_maps") {
        let job = await loadGoogleMapsImportJob(jobId);
        if (!job || job.coach_id !== coach.id) throw new AgentToolError("Import not found.");
        if (job.status === "pending" || job.status === "running") {
          job = await syncGoogleMapsImportJob(job.id).catch(() => job!);
        }
        return {
          kind,
          status: job.status,
          businesses_found: job.progress_count,
          target: job.max_places,
          added_to_list: job.added_count,
          owners_found: job.people_found,
          list: await listName(job.save_list_id),
          error: job.error_message,
        };
      }

      let job = await loadImportJob(jobId);
      if (!job || job.coach_id !== coach.id) throw new AgentToolError("Import not found.");
      if (job.status === "pending" || job.status === "running") {
        job = await syncSalesNavImportJob(job.id).catch(() => job!);
      }
      return {
        kind,
        status: job.status,
        people_found: job.progress_count,
        scraped: job.scraped_count,
        list: await listName(job.save_list_id),
        error: job.error_message,
      };
    },
  },
];
