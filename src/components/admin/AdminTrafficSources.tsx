"use client";

import { useEffect, useState } from "react";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import { trafficLabel } from "@/lib/trafficSource";

type Row = { source: string; count: number };

/** Where BOSS Scores came from: the tag on each person's link (Toolkit link maker). */
export function AdminTrafficSources({ from, to }: { from?: string; to?: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const headers = await getCoachAuthHeaders(null);
      if (!headers || cancelled) return;
      delete headers["x-impersonate-coach-id"];
      const q = new URLSearchParams();
      if (from) q.set("from", from);
      if (to) q.set("to", to);
      const res = await fetch(`/api/admin/traffic-sources?${q}`, { headers }).catch(() => null);
      const body = (await res?.json().catch(() => null)) as { sources?: Row[]; total?: number } | null;
      if (cancelled || !body?.sources) return;
      setRows(body.sources);
      setTotal(body.total ?? 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  if (!rows) return null;
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">Where BOSS Scores came from</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        The tag on the link each person opened. Coaches make tagged links in Toolkit. {total} BOSS Scores in this period.
      </p>
      <ul className="mt-4 space-y-2">
        {rows.map((row) => (
          <li key={row.source} className="grid grid-cols-[9rem_minmax(0,1fr)_3rem] items-center gap-3 text-sm">
            <span className={row.source === "untagged" ? "text-slate-500" : "font-medium text-slate-900"}>
              {row.source === "untagged" ? "No tag" : trafficLabel(row.source)}
            </span>
            <span className="h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden>
              <span
                className={`block h-full rounded-full ${row.source === "untagged" ? "bg-slate-300" : "bg-[#1f7bc7]"}`}
                style={{ width: `${total ? Math.max(2, (100 * row.count) / total) : 0}%` }}
              />
            </span>
            <span className="text-right tabular-nums text-slate-700">{row.count}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
