import { redirect } from "next/navigation";
import { resolvePrimaryCoachSlug } from "@/lib/primaryCoach";

/** @deprecated Use `/assessment-pro` — kept for old bookmarks. */
export default async function DiagnosticRootPage() {
  const slug = await resolvePrimaryCoachSlug();
  redirect(`/assessment-pro/${encodeURIComponent(slug)}`);
}
