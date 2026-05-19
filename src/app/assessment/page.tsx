import { redirect } from "next/navigation";
import { resolvePrimaryCoachSlug } from "@/lib/primaryCoach";

export default async function AssessmentRootPage() {
  const slug = await resolvePrimaryCoachSlug();
  redirect(`/assessment/${encodeURIComponent(slug)}`);
}
