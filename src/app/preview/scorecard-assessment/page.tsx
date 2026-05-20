import { redirect } from "next/navigation";
import { getPrimaryCoachSlug } from "@/lib/primaryCoach";

/** Local dev entry for the full BossScore assessment flow (no landing gate). */
export default function PreviewScorecardAssessmentPage() {
  const slug = getPrimaryCoachSlug();
  redirect(`/assessment/${encodeURIComponent(slug)}?preview=1`);
}
