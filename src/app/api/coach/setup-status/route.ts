import { NextResponse } from "next/server";

import { aboutYouProgress } from "@/lib/practiceKnowledge/aboutYouProgress";
import { findPracticeKnowledge } from "@/lib/practiceKnowledge/store";
import { linkedInSetupState } from "@/lib/unipile/linkedinSetupState";
import { requireOutreachCoach } from "@/lib/unipile/requireOutreachCoach";

export const runtime = "nodejs";

/** What the coach still has to do before BCA can launch them, for the top bar (20 Nov). */
export async function GET(request: Request) {
  const auth = await requireOutreachCoach(request);
  if (auth.error || !auth.coachId) return NextResponse.json({ error: auth.error }, { status: 401 });
  // Never nag on our own error: a check that fails counts as fine.
  const [aboutYou, linkedin] = await Promise.all([
    findPracticeKnowledge(auth.coachId)
      .then(aboutYouProgress)
      .catch(() => ({ state: "done" as const, left: 0 })),
    linkedInSetupState(auth.coachId).catch((err) => {
      console.error("linkedin setup state:", err instanceof Error ? err.message : "failed");
      return "ok" as const;
    }),
  ]);
  return NextResponse.json({ aboutYou, linkedin });
}
