"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";

import { PlaybookBlogShell } from "@/components/playbooks/PlaybookBlogShell";
import { PlaybookTabs } from "@/components/playbooks/PlaybookTabs";
import { getPlaybookMeta } from "@/lib/bossData";
import type { PlaybookContent as PlaybookContentType } from "@/lib/playbookContentTypes";

export default function CoachContactPlaybookDetailPage({
  params,
}: {
  params: Promise<{ id: string; ref: string }>;
}) {
  const { id: contactId, ref } = use(params);
  const [content, setContent] = useState<PlaybookContentType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const meta = getPlaybookMeta(ref);
  if (!meta) {
    return (
      <div className="flex flex-col gap-4 px-4 py-8">
        <p className="text-sm text-rose-600">Playbook not found.</p>
        <Link
          href={`/coach/contacts/${contactId}/playbooks`}
          className="text-sm text-[#0c5290] underline"
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
      <div className="flex flex-col gap-4 px-4 py-8">
        <p className="text-sm text-slate-600">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4 px-4 py-8">
        <p className="text-sm text-rose-600">{error}</p>
        <Link
          href={`/coach/contacts/${contactId}/playbooks`}
          className="text-sm text-[#0c5290] underline"
        >
          Back to Playbooks
        </Link>
      </div>
    );
  }

  return (
    <PlaybookBlogShell
      backHref={`/coach/contacts/${contactId}/playbooks`}
      backLabel="Contact playbooks"
      secondaryNav={{
        href: `/coach/contacts/${contactId}`,
        label: "Contact",
      }}
    >
      <PlaybookTabs
        content={content}
        showClientTab={true}
        showCoachesTab={true}
        basePath={`/coach/contacts/${contactId}/playbooks`}
      />
    </PlaybookBlogShell>
  );
}
