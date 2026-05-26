import { redirect } from "next/navigation";

/** @deprecated Use `/assessment-pro/[coachSlug]/thank-you` — kept for old links. */
export default async function DiagnosticThankYouRedirectPage({
  params,
  searchParams,
}: {
  params: Promise<{ coachSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { coachSlug } = await params;
  const sp = await searchParams;
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === "string") q.set(key, value);
    else if (Array.isArray(value)) {
      for (const entry of value) q.append(key, entry);
    }
  }
  const suffix = q.toString() ? `?${q.toString()}` : "";
  redirect(`/assessment-pro/${encodeURIComponent(coachSlug)}/thank-you${suffix}`);
}
