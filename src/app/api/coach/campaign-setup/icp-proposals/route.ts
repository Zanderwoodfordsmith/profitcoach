import { NextResponse } from "next/server";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generateCampaignJson } from "@/lib/firstCampaign/generateJson";
import { ICP_PROPOSALS_SYSTEM, buildIcpProposalsUser } from "@/lib/firstCampaign/prompts";
import { summarizeLinkedInSnapshot } from "@/lib/firstCampaign/linkedinSummary";
import { countLeadFinderMatches } from "@/lib/leadFinder/searchLeadFinder";
import { HOUSE_ICP_FILTERS, type IcpProposal, type SourcingRoute } from "@/lib/firstCampaign/types";
import type { LinkedInProfileSnapshot } from "@/lib/apify/linkedinProfileTypes";

const STRONG_THRESHOLD = 500;
const THIN_THRESHOLD = 50;

type RawProposal = {
  label?: string;
  industry?: string;
  geography?: string;
  roleTitles?: string[];
  teamSize?: string;
  revenueRange?: string;
  rationale?: string;
  leadFinderHints?: {
    industries?: string[];
    jobTitles?: string[];
    locations?: string[];
  };
};

function sourcingRouteFor(count: number): SourcingRoute {
  if (count >= STRONG_THRESHOLD) return "strong";
  if (count >= THIN_THRESHOLD) return "thin";
  return "none";
}

function inventoryNoteFor(route: SourcingRoute, count: number): string {
  if (route === "strong") {
    return `We have ${count.toLocaleString()} of these — your list is ready in step 5.`;
  }
  if (route === "thin") {
    return `We hold ~${count.toLocaleString()}. We'll build the rest from Sales Navigator or a partner database.`;
  }
  return "Not in our database yet. We'll source this one for you — it's the right target.";
}

export async function POST(request: Request) {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }
  const coachId = auth.userId;

  const [{ data: linkedinRow }, { data: profile }, { data: libraryRows }] = await Promise.all([
    supabaseAdmin
      .from("coach_linkedin_profiles")
      .select("snapshot")
      .eq("coach_id", coachId)
      .maybeSingle(),
    supabaseAdmin
      .from("profiles")
      .select("full_name, coach_business_name")
      .eq("id", coachId)
      .maybeSingle(),
    supabaseAdmin
      .from("icp_avatar_library")
      .select("industry_label, depth")
      .order("depth", { ascending: true }),
  ]);

  const snapshot = (linkedinRow?.snapshot as LinkedInProfileSnapshot | null) ?? null;
  const linkedInSummary = summarizeLinkedInSnapshot(snapshot, {
    fullName: profile?.full_name ?? null,
    businessName: profile?.coach_business_name ?? null,
  });

  const libraryIndustries = [
    ...new Set((libraryRows ?? []).map((r) => r.industry_label as string).filter(Boolean)),
  ];

  const { data, error } = await generateCampaignJson<{ proposals: RawProposal[] }>({
    system: ICP_PROPOSALS_SYSTEM,
    user: buildIcpProposalsUser({ linkedInSummary, libraryIndustries }),
    maxTokens: 2048,
  });

  if (error || !data?.proposals?.length) {
    return NextResponse.json(
      { error: error ?? "Could not generate ICP proposals. Try again." },
      { status: 502 }
    );
  }

  const proposals: IcpProposal[] = await Promise.all(
    data.proposals.slice(0, 3).map(async (raw): Promise<IcpProposal> => {
      const industry = (raw.industry ?? "").trim();
      const geography = (raw.geography ?? HOUSE_ICP_FILTERS.geography).trim();
      const roleTitles =
        raw.roleTitles && raw.roleTitles.length > 0
          ? raw.roleTitles
          : HOUSE_ICP_FILTERS.roleTitles;
      const teamSize = (raw.teamSize ?? HOUSE_ICP_FILTERS.teamSize).trim();
      const revenueRange = (raw.revenueRange ?? HOUSE_ICP_FILTERS.revenueRange).trim();

      const hints = raw.leadFinderHints ?? {};
      const filterInput = {
        industries: hints.industries?.length ? hints.industries : industry ? [industry] : [],
        jobTitles: hints.jobTitles?.length ? hints.jobTitles : roleTitles,
        locations: hints.locations?.length ? hints.locations : geography ? [geography] : [],
      };

      const inventoryCount = await countLeadFinderMatches(filterInput);
      const sourcingRoute = sourcingRouteFor(inventoryCount);

      return {
        label: raw.label?.trim() || industry || "Untitled segment",
        industry,
        geography,
        roleTitles,
        teamSize,
        revenueRange,
        rationale: raw.rationale?.trim() ?? "",
        sourcingRoute,
        inventoryCount,
        inventoryNote: inventoryNoteFor(sourcingRoute, inventoryCount),
        leadFinderFilters: filterInput,
      };
    })
  );

  return NextResponse.json({ proposals, linkedInSummaryUsed: Boolean(snapshot) });
}
