"use client";

import { useEffect, useState } from "react";

type Issue = { level: "blocker" | "warning"; code: string; message: string; step?: number };

/** "Before you launch" panel: what would break, and what usually costs replies. */
export function CampaignLaunchCheck({
  campaignId,
  refreshKey,
  getHeaders,
}: {
  campaignId: string;
  /** Change this to re-check (e.g. when steps are saved). */
  refreshKey: string;
  getHeaders: () => Promise<Record<string, string> | null>;
}) {
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      void (async () => {
        const headers = await getHeaders();
        if (!headers || cancelled) return;
        const res = await fetch(`/api/coach/linkedin-outreach/campaigns/${encodeURIComponent(campaignId)}/check`, { headers });
        const body = (await res.json().catch(() => null)) as { issues?: Issue[] } | null;
        if (!cancelled && res.ok && body?.issues) setIssues(body.issues);
      })();
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [campaignId, refreshKey, getHeaders]);

  if (!issues || issues.length === 0) return null;
  const blockers = issues.filter((i) => i.level === "blocker");
  const warnings = issues.filter((i) => i.level === "warning");

  return (
    <div
      className={`mt-4 rounded-lg border px-3 py-2 text-sm ${blockers.length ? "border-rose-200 bg-rose-50 text-rose-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}
    >
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-2 text-left">
        <span className="font-medium">
          {blockers.length
            ? `Fix ${blockers.length} thing${blockers.length === 1 ? "" : "s"} before this can go live`
            : `${warnings.length} thing${warnings.length === 1 ? "" : "s"} likely to cost you replies`}
        </span>
        <span className="text-xs underline">{open ? "Hide" : "Show"}</span>
      </button>
      {open ? (
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {[...blockers, ...warnings].map((i) => (
            <li key={`${i.code}-${i.step ?? ""}`}>
              {i.level === "blocker" ? <span className="font-medium">Must fix: </span> : null}
              {i.message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
