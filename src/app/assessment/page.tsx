import { redirect } from "next/navigation";
import { getPrimaryCoachSlug, resolvePrimaryCoachSlug } from "@/lib/primaryCoach";

export default async function AssessmentRootPage() {
  let slug = getPrimaryCoachSlug();
  try {
    slug = await resolvePrimaryCoachSlug();
  } catch (err) {
    console.error("resolvePrimaryCoachSlug:", err);
  }
  redirect(`/assessment/${encodeURIComponent(slug)}`);
}
