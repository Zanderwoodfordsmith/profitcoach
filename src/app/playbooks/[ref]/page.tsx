import { notFound } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { loadPlaybookContentWithDb } from "@/lib/playbookContent";
import { PlaybookBlogShell } from "@/components/playbooks/PlaybookBlogShell";
import { PlaybookOverviewContent } from "@/components/playbooks/PlaybookOverviewContent";
import { PlaybookCoachAttribution } from "@/components/playbooks/PlaybookCoachAttribution";

export const dynamic = "force-dynamic";

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

  const content = await loadPlaybookContentWithDb(ref);
  if (!content) notFound();

  return (
    <>
      <PlaybookBlogShell backHref="/playbooks" backLabel="All playbooks">
        <PlaybookOverviewContent content={content} />
        <Suspense fallback={null}>
          <PlaybookCoachAttribution coachSlug={coachSlug} />
        </Suspense>
      </PlaybookBlogShell>

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200 bg-white/95 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.08)] backdrop-blur-sm">
        <div className="mx-auto max-w-4xl px-4 py-3 md:px-8">
          <p className="text-center text-xs text-slate-500">
            Want to see where {content.name} sits in your overall business health?{" "}
            <Link
              href="/landing/a"
              className="font-medium text-[#0c5290] underline decoration-[#0c5290]/30 underline-offset-2 hover:text-[#094271]"
            >
              Take the Profit Coach BOSS Review
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
