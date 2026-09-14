import { NextResponse } from "next/server";
import { requireOutreachCoach } from "@/lib/unipile/requireOutreachCoach";
import { loadCoachOwnLinkedInSsi } from "@/lib/unipile/linkedinSsi";

/**
 * Own-account LinkedIn SSI for the signed-in coach.
 * AuthZ: session coachId must own a connected LinkedIn Unipile account.
 * The LinkedIn identifier is never taken from the request.
 */
export async function GET(request: Request) {
  const auth = await requireOutreachCoach(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const refresh = searchParams.get("refresh") === "1";

  try {
    const ssi = await loadCoachOwnLinkedInSsi(auth.coachId, { refresh });
    if (!ssi.available) {
      return NextResponse.json({
        available: false,
        reason: ssi.reason,
        message: ssi.message,
      });
    }
    return NextResponse.json({
      available: true,
      score: ssi.score,
      industry_top: ssi.industryTop,
      network_top: ssi.networkTop,
      pillars: ssi.pillars,
      fetched_at: ssi.fetchedAt,
      stale: ssi.stale,
    });
  } catch (err) {
    console.error("linkedin ssi route failed", {
      coachId: auth.coachId,
      error: err instanceof Error ? err.message : "unknown",
    });
    return NextResponse.json(
      { error: "Failed to load SSI." },
      { status: 500 }
    );
  }
}
