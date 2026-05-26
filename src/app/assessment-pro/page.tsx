import { redirect } from "next/navigation";
import { resolvePrimaryCoachSlug } from "@/lib/primaryCoach";

export default async function AssessmentProRootPage() {
  const slug = await resolvePrimaryCoachSlug();
  redirect(`/assessment-pro/${encodeURIComponent(slug)}`);
}
