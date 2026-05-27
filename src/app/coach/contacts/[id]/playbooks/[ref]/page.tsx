"use client";

import { Suspense, use, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { PlaybookBlogShell } from "@/components/playbooks/PlaybookBlogShell";
import { PlaybookTabs } from "@/components/playbooks/PlaybookTabs";
import { safeAppReturnTo } from "@/lib/bossGridNavigation";
import { bossProHubPath } from "@/lib/isBossWorkshopPath";
import { getPlaybookMeta } from "@/lib/bossData";
import type { PlaybookContent as PlaybookContentType } from "@/lib/playbookContentTypes";

function playbookBackLabel(returnTo: string | null): string {
  if (returnTo?.includes("/boss-pro")) return "BOSS score";
  return "Contact playbooks";
}

function CoachContactPlaybookDetailContent({
  contactId,
  ref,
}: {
  contactId: string;
  ref: string;
}) {
  const searchParams = useSearchParams();
  const returnTo = safeAppReturnTo(searchParams.get("returnTo"));
  const defaultBackHref = `/coach/contacts/${contactId}/playbooks`;
  const backHref = returnTo ?? defaultBackHref;
  const backLabel = playbookBackLabel(returnTo);

  const [content, setContent] = useState<PlaybookContentType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const meta = getPlaybookMeta(ref);

  useEffect(() => {
    if (!meta) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function init() {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/playbooks/${encodeURIComponent(ref)}`);
      if (cancelled) return;
      const data = res.ok ? ((await res.json()) as PlaybookContentType) : null;
      setContent(data);
      setLoading(false);
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [meta, ref]);

  if (!meta) {
    return (
      <div className="flex flex-col gap-4 px-4 py-8">
        <p className="text-sm text-rose-600">Playbook not found.</p>
        <Link href={backHref} className="text-sm text-[#0c5290] underline">
          ← {backLabel}
        </Link>
      </div>
    );
  }

  if (loading || !content) {
    return (
      <div className="flex flex-col gap-4 px-4 py-8">
        <p className="text-sm text-slate-600">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4 px-4 py-8">
        <p className="text-sm text-rose-600">{error}</p>
        <Link href={backHref} className="text-sm text-[#0c5290] underline">
          ← {backLabel}
        </Link>
      </div>
    );
  }

  const returnQuery = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : "";

  return (
    <PlaybookBlogShell
      backHref={backHref}
      backLabel={backLabel}
      secondaryNav={
        returnTo
          ? undefined
          : {
              href: bossProHubPath(contactId),
              label: "BOSS score",
            }
      }
    >
      <PlaybookTabs
        content={content}
        showClientTab={true}
        showCoachesTab={true}
        basePath={`/coach/contacts/${contactId}/playbooks`}
        linkQuery={returnQuery}
      />
    </PlaybookBlogShell>
  );
}

export default function CoachContactPlaybookDetailPage({
  params,
}: {
  params: Promise<{ id: string; ref: string }>;
}) {
  const { id: contactId, ref } = use(params);

  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-4 px-4 py-8">
          <p className="text-sm text-slate-600">Loading…</p>
        </div>
      }
    >
      <CoachContactPlaybookDetailContent contactId={contactId} ref={ref} />
    </Suspense>
  );
}
