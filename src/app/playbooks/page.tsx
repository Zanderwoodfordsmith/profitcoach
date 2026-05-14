import Link from "next/link";

import { PlaybooksPublicIndex } from "@/components/playbooks/PlaybooksPublicIndex";
import { getAllPlaybookSummaries } from "@/lib/playbookContent";

export const metadata = {
  title: "Playbooks | Profit Coach",
  description:
    "Browse the Profit System playbook library—organized by business area with full overview pages for each playbook.",
};

export default async function PlaybooksIndexPage() {
  const summaries = await getAllPlaybookSummaries();

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link
            href="/"
            className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700 hover:text-sky-800"
          >
            Profit Coach
          </Link>
          <Link
            href="/landing/a"
            className="text-xs font-medium text-sky-700 underline hover:text-sky-800"
          >
            BOSS Review
          </Link>
        </nav>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <PlaybooksPublicIndex summaries={summaries} />
      </div>
    </div>
  );
}
