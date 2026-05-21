import { redirect } from "next/navigation";
import { getPrimaryCoachSlug, resolvePrimaryCoachSlug } from "@/lib/primaryCoach";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AssessmentRootPage({ searchParams }: Props) {
  const sp = await searchParams;
  let slug = getPrimaryCoachSlug();
  try {
    slug = await resolvePrimaryCoachSlug();
  } catch (err) {
    console.error("resolvePrimaryCoachSlug:", err);
  }

  const coachOverride =
    typeof sp.coach === "string" ? sp.coach.trim() : "";
  if (coachOverride) slug = coachOverride;

  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (key === "coach") continue;
    if (typeof value === "string") q.set(key, value);
    else if (Array.isArray(value)) {
      for (const v of value) q.append(key, v);
    }
  }
  const suffix = q.toString() ? `?${q.toString()}` : "";
  redirect(`/assessment/${encodeURIComponent(slug)}${suffix}`);
}
