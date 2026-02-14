"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PlaybookTabs } from "@/components/playbooks/PlaybookTabs";
import { getPlaybookMeta } from "@/lib/bossData";
import type { PlaybookContent as PlaybookContentType } from "@/lib/playbookContentTypes";

export default function CoachContactPlaybookDetailPage({
  params,
}: {
  params: Promise<{ id: string; ref: string }>;
}) {
  const { id: contactId, ref } = use(params);
  const router = useRouter();
  const [content, setContent] = useState<PlaybookContentType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const meta = getPlaybookMeta(ref);
  if (!meta) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-rose-600">Playbook not found.</p>
        <Link
          href={`/coach/contacts/${contactId}/playbooks`}
          className="text-sm text-sky-700 underline"
        >
          Back to Playbooks
        </Link>
      </div>
    );
  }

  useEffect(() => {
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
  }, [ref]);

  if (loading || !content) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-slate-600">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-rose-600">{error}</p>
        <Link
          href={`/coach/contacts/${contactId}/playbooks`}
          className="text-sm text-sky-700 underline"
        >
          Back to Playbooks
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="border-b border-slate-200 pb-3">
        <Link
          href={`/coach/contacts/${contactId}/playbooks`}
          className="text-xs text-slate-500 hover:text-slate-700"
        >
          ← Back to Playbooks
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">
          {content.ref} {content.name} Playbook
        </h1>
        <p className="mt-1 text-sm text-slate-500">{content.subtitle}</p>
      </header>

      <PlaybookTabs
        content={content}
        showClientTab={true}
        showCoachesTab={true}
        basePath={`/coach/contacts/${contactId}/playbooks`}
      />
    </div>
  );
}
