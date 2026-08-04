import { NextResponse } from "next/server";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { LeadrocksError } from "@/lib/apify/leadrocks";
import { searchLeadFinder } from "@/lib/leadFinder/searchLeadFinder";

/** Coach-facing Lead Finder search (First Campaign Setup step 5). Cache/local-DB only — no Apify fills. */
const COACH_MAX_PAGE_SIZE = 100;
/** Soft cap: coaches can save at most this many leads into a starter list via search+save. */
export const COACH_STARTER_LIST_SEARCH_CAP = 100;

export async function POST(request: Request) {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    industries?: string | string[];
    jobTitles?: string | string[];
    locations?: string | string[];
    teamSizes?: string | string[];
    revenueRanges?: string | string[];
    searchQuery?: string;
    teamSize?: string;
    revenueRange?: string;
    page?: number;
    pageSize?: number;
  };

  const toList = (v: string | string[] | undefined): string[] => {
    if (!v) return [];
    if (Array.isArray(v)) return v.map(String);
    return String(v)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  };

  const pageSize = Math.min(
    COACH_MAX_PAGE_SIZE,
    COACH_STARTER_LIST_SEARCH_CAP,
    Number.isFinite(body.pageSize) && (body.pageSize ?? 0) > 0 ? Number(body.pageSize) : 50
  );

  try {
    const result = await searchLeadFinder(
      {
        industries: toList(body.industries),
        jobTitles: toList(body.jobTitles),
        locations: toList(body.locations),
        teamSizes: toList(body.teamSizes),
        revenueRanges: toList(body.revenueRanges),
        searchQuery: body.searchQuery,
        teamSize: body.teamSize,
        revenueRange: body.revenueRange,
        page: body.page,
        pageSize,
      },
      { forceApify: false }
    );
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof LeadrocksError) {
      const status =
        err.code === "not_configured" ? 503 : err.code === "invalid_input" ? 400 : 502;
      return NextResponse.json({ error: err.message }, { status });
    }
    console.error("Coach lead finder search failed:", err);
    return NextResponse.json({ error: "Lead search failed." }, { status: 502 });
  }
}
