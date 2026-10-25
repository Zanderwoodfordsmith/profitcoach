"use client";

import { useEffect, useState } from "react";
import type { ClientInsights, Share } from "@/lib/clientRoster/insights";
import { cardClass } from "@/components/ui/Card";

function Bars({ title, items }: { title: string; items: Share[] }) {
  if (!items.length) return null;
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <ul className="mt-1 space-y-1">
        {items.slice(0, 4).map((i) => (
          <li key={i.key} className="text-sm text-slate-700">
            <div className="flex justify-between gap-2">
              <span className="truncate">{i.label}</span>
              <span className="tabular-nums text-slate-500">{Math.round(i.share * 100)}%</span>
            </div>
            <div className="h-1 rounded bg-slate-100">
              <div className="h-1 rounded bg-sky-600" style={{ width: `${Math.round(i.share * 100)}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** What this coach's best clients have in common, so campaigns can find more of them. */
export function BestClientsCard({ authHeaders, refreshKey }: { authHeaders: () => Promise<Record<string, string> | null>; refreshKey: string }) {
  const [data, setData] = useState<ClientInsights | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const headers = await authHeaders();
      if (!headers || cancelled) return;
      const res = await fetch("/api/coach/clients/insights", { headers });
      const body = (await res.json().catch(() => null)) as { insights?: ClientInsights } | null;
      if (!cancelled && res.ok && body?.insights) setData(body.insights);
    })();
    return () => {
      cancelled = true;
    };
  }, [authHeaders, refreshKey]);

  if (!data || data.clients === 0) return null;
  return (
    <section className={cardClass("plain", "p-4")}>
      <h3 className="text-sm font-semibold text-slate-900">Your best clients</h3>
      <p className="mt-1 text-sm text-slate-700">
        {data.summary ?? "Add sector, turnover, team size and how they found you to see who your best clients are."}
      </p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Bars title="Sector" items={data.sectors} />
        <Bars title="Turnover" items={data.revenue} />
        <Bars title="Team size" items={data.team} />
        <Bars title="How they found you" items={data.sources} />
      </div>
      {data.missing.length ? <p className="mt-3 text-xs text-slate-500">To sharpen this: {data.missing.join("; ")}.</p> : null}
    </section>
  );
}
