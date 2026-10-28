"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import type { Proposal, ProposalKind } from "@/lib/proposals/types";
import { ProposalStatusPill, proposalActivity } from "./ProposalStatus";
import { buttonClass } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import { fieldClass } from "@/components/ui/Field";

type ClientOption = { id: string; full_name: string | null; business_name: string | null; email: string | null };

const TEXT: Record<ProposalKind, { heading: string; lead: string; add: string; who: string; start: string; emptyTitle: string; empty: string }> = {
  proposal: {
    heading: "Proposals",
    lead: "A proposal for each owner, written from your Blueprint. Change any part, send the link, and see when they open and sign it.",
    add: "New proposal",
    who: "Who is it for?",
    start: "Start the proposal",
    emptyTitle: "No proposals yet",
    empty: "After a good Profit Roadmap call, start one here. It fills in from your Blueprint, so it takes minutes.",
  },
  welcome: {
    heading: "Welcome packs",
    lead: "A welcome pack for each new client: your first month together, how you work, and what you need from them. Send the link or save a PDF.",
    add: "New welcome pack",
    who: "Which client?",
    start: "Make the welcome pack",
    emptyTitle: "No welcome packs yet",
    empty: "When a client signs, make theirs here, or from the signed proposal.",
  },
};

/**
 * Get Clients → Proposals, or Keep Clients → Welcome packs: every one the
 * coach has started, and where each one stands.
 */
export function ProposalsList({ kind = "proposal" }: { kind?: ProposalKind }) {
  const { impersonatingCoachId } = useImpersonation();
  const router = useRouter();
  const t = TEXT[kind];
  const base = `${usePathname().startsWith("/admin") ? "/admin" : "/coach"}/${kind === "welcome" ? "welcome-packs" : "proposals"}`;
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [contactId, setContactId] = useState("");
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
      const res = await fetch(`/api/coach/proposals?kind=${kind}`, { headers });
      const body = (await res.json().catch(() => null)) as { proposals?: Proposal[]; error?: string } | null;
      if (cancelled) return;
      if (!res.ok || !body?.proposals) setError(body?.error ?? "Could not load your proposals.");
      else setRows(body.proposals);
    })();
    return () => {
      cancelled = true;
    };
  }, [impersonatingCoachId, kind]);

  // Welcome packs start from one of the coach's clients.
  useEffect(() => {
    if (kind !== "welcome") return;
    let cancelled = false;
    void (async () => {
      const headers = await getCoachAuthHeaders(impersonatingCoachId);
      if (!headers || cancelled) return;
      const res = await fetch("/api/coach/clients", { headers }).catch(() => null);
      const body = (await res?.json().catch(() => null)) as { clients?: ClientOption[] } | null;
      if (!cancelled && body?.clients) setClients(body.clients);
    })();
    return () => {
      cancelled = true;
    };
  }, [impersonatingCoachId, kind]);

  const create = async () => {
    if (!form.prospect_name.trim()) {
      setError("Add the prospect's name.");
      return;
    }
    setSaving(true);
    const headers = await getCoachAuthHeaders(impersonatingCoachId);
    if (!headers) return;
    const res = await fetch("/api/coach/proposals", {
      method: "POST",
      headers,
      body: JSON.stringify({ ...form, kind, contact_id: contactId || undefined }),
    });
    const body = (await res.json().catch(() => null)) as { proposal?: Proposal; error?: string } | null;
    setSaving(false);
    if (!res.ok || !body?.proposal) {
      setError(body?.error ?? "Could not start the proposal.");
      return;
    }
    router.push(`${base}/${body.proposal.id}`);
  };


  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{t.heading}</h2>
          <p className="mt-0.5 max-w-xl text-sm text-slate-600">{t.lead}</p>
        </div>
        {adding ? null : (
          <button
            type="button"
            onClick={() => {
              setAdding(true);
              setError(null);
            }}
            className={buttonClass("main")}
          >
            <Plus className="h-4 w-4" aria-hidden />
            {t.add}
          </button>
        )}
      </div>

      {adding ? (
        <form
          className={cardClass("plain", "mt-5 p-5")}
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <p className="text-sm font-medium text-slate-900">{t.who}</p>
          {kind === "welcome" && clients.length ? (
            <label className="mt-3 block max-w-sm text-xs font-medium text-slate-600">
              Pick from your clients
              <select
                id="proposal-client"
                className={fieldClass("select", "normal", "mt-1")}
                value={contactId}
                onChange={(e) => {
                  const c = clients.find((x) => x.id === e.target.value);
                  setContactId(e.target.value);
                  if (c) setForm({ prospect_name: c.full_name ?? "", prospect_business: c.business_name ?? "", prospect_email: c.email ?? "" });
                }}
              >
                <option value="">Choose a client, or type below</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {[c.full_name, c.business_name].filter(Boolean).join(", ")}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-medium text-slate-600">
              Their name
              <input id="proposal-name" className={fieldClass("input", "normal", "mt-1")} value={form.prospect_name} onChange={(e) => setForm({ ...form, prospect_name: e.target.value })} placeholder="e.g. Mike Hartley" autoFocus />
            </label>
            <label className="text-xs font-medium text-slate-600">
              Their business
              <input id="proposal-business" className={fieldClass("input", "normal", "mt-1")} value={form.prospect_business} onChange={(e) => setForm({ ...form, prospect_business: e.target.value })} placeholder="e.g. Hartley HVAC Ltd" />
            </label>
            <label className="text-xs font-medium text-slate-600">
              Their email (to send it)
              <input id="proposal-email" type="email" className={fieldClass("input", "normal", "mt-1")} value={form.prospect_email} onChange={(e) => setForm({ ...form, prospect_email: e.target.value })} placeholder="mike@hartleyhvac.co.uk" />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="submit" disabled={saving} className={buttonClass("main")}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {saving ? "Writing it from your Blueprint…" : t.start}
            </button>
            <button type="button" onClick={() => setAdding(false)} className={buttonClass("quiet")}>
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
            <p className="text-sm font-semibold text-slate-900">{t.emptyTitle}</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-slate-600">{t.empty}</p>
          </div>
        ) : rows ? (
          <ul className={cardClass("plain", "divide-y divide-slate-100 overflow-hidden")}>
            {rows.map((p) => (
              <li key={p.id}>
                <Link href={`${base}/${p.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3.5 hover:bg-slate-50 sm:flex-nowrap">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900">{p.prospect_business || p.prospect_name}</span>
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
