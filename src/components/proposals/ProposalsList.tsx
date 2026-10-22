"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import type { Proposal } from "@/lib/proposals/types";
import { ProposalStatusPill, proposalActivity } from "./ProposalStatus";

/** Get Clients → Proposals: every proposal the coach has started, and where each one stands. */
export function ProposalsList() {
  const { impersonatingCoachId } = useImpersonation();
  const router = useRouter();
  const base = usePathname().startsWith("/admin") ? "/admin/proposals" : "/coach/proposals";
  const [rows, setRows] = useState<Proposal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ prospect_name: "", prospect_business: "", prospect_email: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const headers = await getCoachAuthHeaders(impersonatingCoachId);
      if (!headers || cancelled) return;
      const res = await fetch("/api/coach/proposals", { headers });
      const body = (await res.json().catch(() => null)) as { proposals?: Proposal[]; error?: string } | null;
      if (cancelled) return;
      if (!res.ok || !body?.proposals) setError(body?.error ?? "Could not load your proposals.");
      else setRows(body.proposals);
    })();
    return () => {
      cancelled = true;
    };
  }, [impersonatingCoachId]);

  const create = async () => {
    if (!form.prospect_name.trim()) {
      setError("Add the prospect's name.");
      return;
    }
    setSaving(true);
    const headers = await getCoachAuthHeaders(impersonatingCoachId);
    if (!headers) return;
    const res = await fetch("/api/coach/proposals", { method: "POST", headers, body: JSON.stringify(form) });
    const body = (await res.json().catch(() => null)) as { proposal?: Proposal; error?: string } | null;
    setSaving(false);
    if (!res.ok || !body?.proposal) {
      setError(body?.error ?? "Could not start the proposal.");
      return;
    }
    router.push(`${base}/${body.proposal.id}`);
  };

  const input =
    "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-100";

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Proposals</h2>
          <p className="mt-0.5 max-w-xl text-sm text-slate-600">
            A proposal for each owner, written from your Blueprint. Change any part, send the link, and see when they open and sign it.
          </p>
        </div>
        {adding ? null : (
          <button
            type="button"
            onClick={() => {
              setAdding(true);
              setError(null);
            }}
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[#0c5290] px-4 text-sm font-semibold text-white hover:bg-[#08396a]"
          >
            <Plus className="h-4 w-4" aria-hidden />
            New proposal
          </button>
        )}
      </div>

      {adding ? (
        <form
          className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <p className="text-sm font-semibold text-slate-900">Who is it for?</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-medium text-slate-600">
              Their name
              <input id="proposal-name" className={`${input} mt-1`} value={form.prospect_name} onChange={(e) => setForm({ ...form, prospect_name: e.target.value })} placeholder="e.g. Mike Hartley" autoFocus />
            </label>
            <label className="text-xs font-medium text-slate-600">
              Their business
              <input id="proposal-business" className={`${input} mt-1`} value={form.prospect_business} onChange={(e) => setForm({ ...form, prospect_business: e.target.value })} placeholder="e.g. Hartley HVAC Ltd" />
            </label>
            <label className="text-xs font-medium text-slate-600">
              Their email (to send it)
              <input id="proposal-email" type="email" className={`${input} mt-1`} value={form.prospect_email} onChange={(e) => setForm({ ...form, prospect_email: e.target.value })} placeholder="mike@hartleyhvac.co.uk" />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="submit" disabled={saving} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#0c5290] px-4 text-sm font-semibold text-white hover:bg-[#08396a] disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {saving ? "Writing it from your Blueprint…" : "Start the proposal"}
            </button>
            <button type="button" onClick={() => setAdding(false)} className="h-9 rounded-full px-3 text-sm font-medium text-slate-600 hover:text-slate-900">
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {error ? <p className="mt-4 text-sm text-rose-700">{error}</p> : null}

      <div className="mt-6">
        {rows === null && !error ? (
          <p className="flex items-center gap-2 py-8 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…
          </p>
        ) : rows && rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 px-6 py-12 text-center">
            <p className="text-sm font-semibold text-slate-900">No proposals yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-slate-600">
              After a good Profit Roadmap call, start one here. It fills in from your Blueprint, so it takes minutes.
            </p>
          </div>
        ) : rows ? (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {rows.map((p) => (
              <li key={p.id}>
                <Link href={`${base}/${p.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3.5 hover:bg-slate-50 sm:flex-nowrap">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">{p.prospect_business || p.prospect_name}</span>
                    <span className="block truncate text-xs text-slate-500">{p.prospect_business ? p.prospect_name : p.prospect_email ?? ""}</span>
                  </span>
                  <span className="text-xs text-slate-500 sm:w-48 sm:text-right">{proposalActivity(p)}</span>
                  <ProposalStatusPill status={p.status} />
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
