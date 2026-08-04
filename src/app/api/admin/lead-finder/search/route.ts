import { NextResponse } from "next/server";
import { LeadrocksError } from "@/lib/apify/leadrocks";
import { requireLeadFinderAccess } from "@/lib/requireLeadFinderAccess";
import { searchLeadFinder } from "@/lib/leadFinder/searchLeadFinder";

export async function POST(request: Request) {
  const auth = await requireLeadFinderAccess(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json(
      { error: auth.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    categories?: string | string[];
    searchQuery?: string;
    states?: string | string[];
    locations?: string | string[];
    jobTitles?: string | string[];
    jobTitleExcludes?: string | string[];
    industries?: string | string[];
    companies?: string | string[];
    companyExcludes?: string | string[];
    teamSizes?: string | string[];
    revenueRanges?: string | string[];
    requireContacts?: string | string[];
    teamSize?: string;
    revenueRange?: string;
    maxItems?: number;
    page?: number;
    pageSize?: number;
    forceApify?: boolean;
  };

  const toList = (v: string | string[] | undefined): string[] => {
    if (!v) return [];
    if (Array.isArray(v)) return v.map(String);
    return String(v)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  };

  try {
    const result = await searchLeadFinder(
      {
        categories: toList(body.categories),
        searchQuery: body.searchQuery,
        states: toList(body.states),
        locations: toList(body.locations),
        jobTitles: toList(body.jobTitles),
        jobTitleExcludes: toList(body.jobTitleExcludes),
        industries: toList(body.industries),
        companies: toList(body.companies),
        companyExcludes: toList(body.companyExcludes),
        teamSizes: toList(body.teamSizes),
        revenueRanges: toList(body.revenueRanges),
        requireContacts: toList(body.requireContacts).filter(
          (v): v is "email" | "phone" | "linkedin" =>
            v === "email" || v === "phone" || v === "linkedin"
        ),
        teamSize: body.teamSize,
        revenueRange: body.revenueRange,
        maxItems: body.maxItems,
        page: body.page,
        pageSize: body.pageSize,
      },
      { forceApify: Boolean(body.forceApify) }
    );
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof LeadrocksError) {
      const status =
        err.code === "not_configured"
          ? 503
          : err.code === "invalid_input"
            ? 400
            : 502;
      return NextResponse.json({ error: err.message }, { status });
    }
    console.error("Lead finder search failed:", err);
    return NextResponse.json({ error: "Lead search failed." }, { status: 502 });
  }
}
