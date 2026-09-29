import { NextResponse } from "next/server";

import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { loadCoachLinkedInSummary } from "@/lib/firstCampaign/loadCoachContext";
import { seedPracticeFromLinkedIn } from "@/lib/practiceKnowledge/ingestLinkedIn";

export const maxDuration = 60;

export async function POST(request: Request) {
  const check = await requireCoachRequest(request, { allowAdminSelf: true });
  if (check.error || !check.userId) {
    return NextResponse.json({ error: check.error ?? "Unauthorized" }, { status: 401 });
  }

  try {
    const { knowledge, scraped } = await seedPracticeFromLinkedIn(check.userId, {
      scrape: true,
    });
    const { summary, snapshot } = await loadCoachLinkedInSummary(check.userId);

    return NextResponse.json({
      knowledge,
      linkedin_summary: summary,
      has_snapshot: Boolean(snapshot),
      scraped,
    });
  } catch (err) {
    console.error("practice seed-linkedin:", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Could not seed from LinkedIn." }, { status: 500 });
  }
}
