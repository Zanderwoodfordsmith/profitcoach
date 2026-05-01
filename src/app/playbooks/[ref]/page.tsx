import { notFound } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { loadPlaybookContentWithDb } from "@/lib/playbookContent";
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
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <nav className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <Link
            href="/"
            className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700 hover:text-sky-800"
          >
            Profit Coach
          </Link>
          <div className="flex items-center gap-6">
            <span className="text-xs text-slate-400">Menu</span>
            <span className="text-xs text-slate-400">Menu</span>
            <button
              type="button"
              className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700"
            >
              CTA
            </button>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 pb-24">
        <PlaybookOverviewContent content={content} />
        <Suspense fallback={null}>
          <PlaybookCoachAttribution coachSlug={coachSlug} />
        </Suspense>
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <p className="text-center text-xs text-slate-500">
            Want to see where {content.name} sits in your overall business health?{" "}
            <Link
              href="/landing/a"
              className="font-medium text-sky-700 underline hover:text-sky-800"
            >
              Take the Profit Coach BOSS Review
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
