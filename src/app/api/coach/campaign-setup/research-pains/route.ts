import { NextResponse } from "next/server";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { researchMarketPains } from "@/lib/firstCampaign/researchMarketPains";

export const maxDuration = 120;

/** Research real market language (Reddit → quote extract) for Profile pains. */
export async function POST(request: Request) {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    industry?: string;
    roleTitles?: string[];
    geography?: string;
    teamSize?: string;
  };

  const industry = body.industry?.trim();
  if (!industry) {
    return NextResponse.json(
      { error: "Industry is required to research market language." },
      { status: 400 }
    );
  }

  try {
    const result = await researchMarketPains({
      industry,
      roleTitles: Array.isArray(body.roleTitles) ? body.roleTitles : [],
      geography: body.geography,
      teamSize: body.teamSize,
    });

    if (result.quotes.length === 0) {
      return NextResponse.json({
        quotes: [],
        snippetsUsed: result.snippetsUsed,
        providers: result.providers,
        queries: result.queries,
        warning:
          "Couldn't find enough public discussion for this niche. Keep editing the draft pains, or try again.",
      });
    }

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Research failed. Try again in a moment.",
      },
      { status: 502 }
    );
  }
}
