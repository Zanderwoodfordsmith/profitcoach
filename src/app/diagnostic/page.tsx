import { redirect } from "next/navigation";
import { resolvePrimaryCoachSlug } from "@/lib/primaryCoach";

export default async function DiagnosticRootPage() {
  const slug = await resolvePrimaryCoachSlug();
  redirect(`/diagnostic/${encodeURIComponent(slug)}`);
}
