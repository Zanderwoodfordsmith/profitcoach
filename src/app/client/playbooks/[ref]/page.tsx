"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseClient } from "@/lib/supabaseClient";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { PlaybookTabs } from "@/components/playbooks/PlaybookTabs";
import { getPlaybookMeta } from "@/lib/bossData";
import type { PlaybookContent as PlaybookContentType } from "@/lib/playbookContentTypes";

export default function ClientPlaybookDetailPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = use(params);
  const router = useRouter();
  const { impersonatingContactId } = useImpersonation();
  const [content, setContent] = useState<PlaybookContentType | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const meta = getPlaybookMeta(ref);
  if (!meta) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-rose-600">Playbook not found.</p>
        <Link href="/client/playbooks" className="text-sm text-sky-700 underline">
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

      const {
        data: { session },
      } = await supabaseClient.auth.getSession();

      if (!session?.access_token) {
        router.replace("/login");
        return;
      }

      const contentRes = await fetch(`/api/playbooks/${encodeURIComponent(ref)}`);
      if (cancelled) return;
      const contentData = contentRes.ok
        ? ((await contentRes.json()) as PlaybookContentType)
        : null;
      if (cancelled) return;
      setContent(contentData);

      const meHeaders: Record<string, string> = {
        Authorization: `Bearer ${session.access_token}`,
      };
      if (impersonatingContactId) {
        meHeaders["x-impersonate-contact-id"] = impersonatingContactId;
      }
      const meRes = await fetch("/api/client/me", { headers: meHeaders });
      if (cancelled) return;

      if (!meRes.ok) {
        setError("Unable to load your data.");
        setLoading(false);
        return;
      }

      const meBody = (await meRes.json()) as { contact?: { id: string } };
      const contactId = meBody.contact?.id;

      if (contactId) {
        const unlocksHeaders: Record<string, string> = {
          Authorization: `Bearer ${session.access_token}`,
        };
        if (impersonatingContactId) {
          unlocksHeaders["x-impersonate-contact-id"] = impersonatingContactId;
        }
        const unlocksRes = await fetch(
          `/api/client/playbooks/unlocks?contact_id=${encodeURIComponent(contactId)}`,
          { headers: unlocksHeaders }
        );
        if (cancelled) return;
        if (unlocksRes.ok) {
          const unlocksBody = (await unlocksRes.json()) as {
            unlocks?: string[];
          };
          setUnlocked((unlocksBody.unlocks ?? []).includes(ref));
        }
      }

      setLoading(false);
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [ref, router, impersonatingContactId]);

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
        <Link href="/client/playbooks" className="text-sm text-sky-700 underline">
          Back to Playbooks
        </Link>
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="flex flex-col gap-4">
        <header className="border-b border-slate-200 pb-3">
          <Link
            href="/client/playbooks"
            className="text-xs text-slate-500 hover:text-slate-700"
          >
            ← Back to Playbooks
          </Link>
          <h1 className="mt-2 text-xl font-semibold text-slate-900">
            {content.ref} {content.name} Playbook
          </h1>
          <p className="mt-1 text-sm text-slate-500">{content.subtitle}</p>
        </header>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
          <p className="font-medium text-amber-900">
            This playbook is locked
          </p>
          <p className="mt-2 text-sm text-amber-800">
            Ask your coach to unlock it for you to access the full content,
            checklists, and materials.
          </p>
          <Link
            href="/client/playbooks"
            className="mt-4 inline-block text-sm font-medium text-sky-700 underline hover:text-sky-800"
          >
            Back to Playbooks
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="border-b border-slate-200 pb-3">
        <Link
          href="/client/playbooks"
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
        showCoachesTab={false}
        basePath="/client/playbooks"
      />
    </div>
  );
}
