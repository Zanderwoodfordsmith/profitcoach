import { notFound } from "next/navigation";
import Link from "next/link";
import { supabaseClient } from "@/lib/supabaseClient";
import { loadPlaybookContentSync } from "@/lib/playbookContent";
import { PlaybookOverviewContent } from "@/components/playbooks/PlaybookOverviewContent";
import { CoachAttribution } from "@/components/playbooks/CoachAttribution";

type Props = {
  params: Promise<{ ref: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function PlaybookPage({ params, searchParams }: Props) {
  const { ref } = await params;
  const resolvedSearchParams = await searchParams;
  const coachSlug =
    typeof resolvedSearchParams.coach === "string"
      ? resolvedSearchParams.coach.trim()
      : null;

  const content = loadPlaybookContentSync(ref);
  if (!content) notFound();

  let coach: {
    full_name: string | null;
    coach_business_name: string | null;
    avatar_url: string | null;
    linkedin_url: string | null;
    slug: string;
  } | null = null;

  if (coachSlug) {
    const { data } = await supabaseClient
      .from("coaches")
      .select("slug, profiles(full_name, coach_business_name, avatar_url, linkedin_url)")
      .eq("slug", coachSlug)
      .maybeSingle();

    if (data) {
      const row = data as unknown as {
        slug: string;
        profiles?: { full_name?: string; coach_business_name?: string; avatar_url?: string; linkedin_url?: string } | null;
      };
      const prof = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      coach = {
        slug: row.slug,
        full_name: prof?.full_name ?? null,
        coach_business_name: prof?.coach_business_name ?? null,
        avatar_url: prof?.avatar_url ?? null,
        linkedin_url: prof?.linkedin_url ?? null,
      };
      if (!coach.full_name && !coach.coach_business_name && row.slug?.toUpperCase() === "BCA") {
        coach.coach_business_name = "Central (BCA)";
      }
    }
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <Link
            href="/"
            className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700 hover:text-sky-800"
          >
            Profit Coach
          </Link>
          <p className="mt-1 text-xs text-slate-500">
            Want to see where {content.name} sits in your overall business health?{" "}
            <Link
              href="/landing/a"
              className="font-medium text-sky-700 underline hover:text-sky-800"
            >
              Take the Profit Coach BOSS Review
            </Link>
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <PlaybookOverviewContent content={content} />
        {coach && <CoachAttribution coach={coach} />}
      </main>
    </div>
  );
}
