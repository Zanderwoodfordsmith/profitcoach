"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { ToolkitHubTabs } from "@/components/admin/ToolkitHubTabs";
import { DashboardPageSection, StickyPageHeader } from "@/components/layout";
import { supabaseClient } from "@/lib/supabaseClient";
import type { SalesNavImportRunRow } from "@/app/api/admin/sales-nav-imports/route";

type Totals = {
  scraped: number;
  inserted: number;
  updated: number;
  costUsd: number;
  runCount: number;
  avgDurationMs: number | null;
};

function formatUsd(n: number): string {
  if (n === 0) return "$0";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function formatDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec < 10 ? sec.toFixed(1) : Math.round(sec)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${s}s`;
}

export function SalesNavImportsPanel() {
  const [runs, setRuns] = useState<SalesNavImportRunRow[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const {
          data: { session },
        } = await supabaseClient.auth.getSession();
        if (!session?.access_token) {
          setError("Not signed in.");
          return;
        }
        const res = await fetch("/api/admin/sales-nav-imports", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const body = (await res.json().catch(() => ({}))) as {
          runs?: SalesNavImportRunRow[];
          totals?: Totals;
          error?: string;
        };
        if (!res.ok) {
          setError(body.error ?? "Could not load import runs.");
          return;
        }
        setRuns(body.runs ?? []);
        setTotals(body.totals ?? null);
      } catch {
        setError("Could not load import runs.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <DashboardPageSection
      header={
        <StickyPageHeader
          title="Sales Nav imports"
          description="Apify cookie scrapes and Unipile connected-session imports into the shared lead cache. Open Lead Finder → Sales Nav → History to re-view leads from a run."
          tabs={<ToolkitHubTabs />}
        />
      }
      contentMaxWidthClass="max-w-6xl"
    >
        {error ? (
          <p className="mb-4 text-sm text-rose-700" role="alert">
            {error}
          </p>
        ) : null}

        {totals ? (
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Stat label="Runs" value={String(totals.runCount)} />
            <Stat
              label="Scraped"
              value={totals.scraped.toLocaleString()}
            />
            <Stat
              label="New in DB"
              value={totals.inserted.toLocaleString()}
            />
            <Stat label="Est. Apify" value={formatUsd(totals.costUsd)} />
            <Stat
              label="Avg duration"
              value={formatDuration(totals.avgDurationMs)}
            />
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-2 py-16 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : runs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-16 text-center">
            <p className="text-sm font-medium text-slate-800">No imports yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
              Runs appear here after Lead Finder → Sales Navigator imports.
              Cost assumes Short mode at $0.002 per search page.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
                <tr>
                  <th className="px-3 py-2.5 font-medium">When</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Via</th>
                  <th className="px-3 py-2.5 font-medium">Name</th>
                  <th className="px-3 py-2.5 font-medium">Who</th>
                  <th className="px-3 py-2.5 font-medium text-right">Scraped</th>
                  <th className="px-3 py-2.5 font-medium text-right">New</th>
                  <th className="px-3 py-2.5 font-medium text-right">Updated</th>
                  <th className="px-3 py-2.5 font-medium text-right">Pages</th>
                  <th className="px-3 py-2.5 font-medium text-right">Duration</th>
                  <th className="px-3 py-2.5 font-medium text-right">Est. cost</th>
                  <th className="px-3 py-2.5 font-medium">Search</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {runs.map((run) => (
                  <tr key={run.id} className="bg-white">
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">
                      {formatWhen(run.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-600">
                      {run.status === "running" || run.status === "pending"
                        ? `Running${
                            run.progressCount
                              ? ` (${run.progressCount})`
                              : ""
                          }`
                        : run.status === "failed"
                          ? "Failed"
                          : "Done"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-600">
                      {run.provider === "unipile" ? "Unipile" : "Apify"}
                    </td>
                    <td className="max-w-[14rem] px-3 py-2.5">
                      <div className="truncate font-medium text-slate-900">
                        {run.name || "—"}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-slate-900">
                        {run.coachName || "—"}
                      </div>
                      {run.coachBusinessName &&
                      run.coachBusinessName !== run.coachName ? (
                        <div className="text-xs text-slate-500">
                          {run.coachBusinessName}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-800">
                      {run.scrapedCount}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700">
                      {run.cacheInserted}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                      {run.cacheUpdated}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                      {run.takePages ?? "—"}
                    </td>
                    <td
                      className="px-3 py-2.5 text-right tabular-nums text-slate-800"
                      title={
                        run.durationMs != null
                          ? `${run.durationMs.toLocaleString()} ms`
                          : undefined
                      }
                    >
                      {formatDuration(run.durationMs)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-800">
                      {run.provider === "unipile"
                        ? "—"
                        : formatUsd(run.estimatedCostUsd)}
                    </td>
                    <td className="px-3 py-2.5">
                      {run.salesNavUrl ? (
                        <a
                          href={run.salesNavUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
                        >
                          Open
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-4 text-xs text-slate-400">
          Est. cost = pages × $0.002 (Apify Short / search-page event). Duration
          is wall-clock for scrape + cache upsert. Full profile enrichment is
          not used on import.
        </p>
      </DashboardPageSection>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-slate-900">
        {value}
      </p>
    </div>
  );
}
