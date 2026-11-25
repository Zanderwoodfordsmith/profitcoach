"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";

import { supabaseClient } from "@/lib/supabaseClient";

/**
 * Where the coach was when they sent the message (25 Nov): a lesson shows its
 * title and course, so BCA knows what it's about without opening the page.
 */
export function SupportSentFrom({ path }: { path: string }) {
  const [named, setNamed] = useState<{ title: string; detail: string | null } | null>(null);

  useEffect(() => {
    let live = true;
    setNamed(null);
    void (async () => {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch(`/api/admin/support/sent-from?path=${encodeURIComponent(path)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      }).catch(() => null);
      const data = (await res?.json().catch(() => null)) as { title?: string; detail?: string | null } | null;
      if (live && data?.title) setNamed({ title: data.title, detail: data.detail ?? null });
    })();
    return () => {
      live = false;
    };
  }, [path]);

  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-slate-600">Sent from</span>
      <a
        href={path}
        target="_blank"
        rel="noopener noreferrer"
        title="Open the page they were on"
        className="group flex items-start gap-1.5 text-sm font-medium text-slate-900 hover:text-sky-700"
      >
        <span className="min-w-0 flex-1 break-words group-hover:underline">{named?.title ?? path}</span>
        <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-sky-700" aria-hidden />
      </a>
      {named?.detail ? <p className="mt-0.5 text-xs text-slate-500">{named.detail}</p> : null}
    </div>
  );
}
