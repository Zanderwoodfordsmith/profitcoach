"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ExternalLink, Eye, EyeOff, Loader2, Pencil } from "lucide-react";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import { proposalPath, type Proposal, type ProposalSection } from "@/lib/proposals/types";
import { ProposalBody } from "./ProposalBody";
import { ProposalStatusPill, proposalActivity } from "./ProposalStatus";
import "@/components/coachExplainer/explainerDigital.css";
import "./proposal.css";

/** What an empty section should hold, so the coach knows before sending. */
const EMPTY_HINT: Partial<Record<ProposalSection["key"], string>> = {
  investment: "Add your price and how they pay. Your Blueprint has no price yet, so this starts empty.",
  terms: "Paste your coaching agreement here, so they read the terms before they sign.",
};

/**
 * One proposal: the prospect's details, then every section as the prospect
 * will read it, each with Edit and Show/Hide. A signed proposal is locked.
 */
export function ProposalEditor({ id }: { id: string }) {
  const { impersonatingCoachId } = useImpersonation();
  const base = usePathname().startsWith("/admin") ? "/admin/proposals" : "/coach/proposals";
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const headers = await getCoachAuthHeaders(impersonatingCoachId);
      if (!headers || cancelled) return;
      const res = await fetch(`/api/coach/proposals/${id}`, { headers });
      const body = (await res.json().catch(() => null)) as { proposal?: Proposal; error?: string } | null;
      if (cancelled) return;
      if (!res.ok || !body?.proposal) setError(body?.error ?? "Could not load the proposal.");
      else setProposal(body.proposal);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, impersonatingCoachId]);

  const save = async (patch: Record<string, unknown>): Promise<boolean> => {
    const headers = await getCoachAuthHeaders(impersonatingCoachId);
    if (!headers) return false;
    const res = await fetch(`/api/coach/proposals/${id}`, { method: "PATCH", headers, body: JSON.stringify(patch) });
    const body = (await res.json().catch(() => null)) as { proposal?: Proposal; error?: string } | null;
    if (!res.ok || !body?.proposal) {
      setError(body?.error ?? "Could not save.");
      return false;
    }
    setError(null);
    setProposal(body.proposal);
    return true;
  };

  if (!proposal) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        {error ? <p className="text-sm text-rose-700">{error}</p> : <Loader2 className="h-5 w-5 animate-spin text-slate-400" aria-label="Loading" />}
      </div>
    );
  }

  const locked = proposal.status === "signed";
  const setSection = (key: string, next: Partial<ProposalSection>) =>
    save({ sections: proposal.sections.map((s) => (s.key === key ? { ...s, ...next } : s)) });

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <Link href={base} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" aria-hidden /> All proposals
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold text-slate-900">{proposal.prospect_business || proposal.prospect_name}</h2>
            <ProposalStatusPill status={proposal.status} />
          </div>
          <p className="mt-0.5 text-sm text-slate-500">{proposalActivity(proposal)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`${proposalPath(proposal.share_token)}?preview=1`}
            target="_blank"
            rel="noopener"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 hover:border-slate-300 hover:text-slate-900"
          >
            <ExternalLink className="h-4 w-4" aria-hidden />
            See what they see
          </a>
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-rose-700">{error}</p> : null}
      {locked ? (
        <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900 ring-1 ring-inset ring-emerald-200">
          Signed by {proposal.signed_name} on {new Date(proposal.signed_at!).toLocaleString("en-GB")}. It can&apos;t change now.
        </p>
      ) : null}

      <ProspectDetails proposal={proposal} locked={locked} onSave={save} />

      <div className="mt-8 grid gap-8 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label="Sections" className="hidden lg:block">
          <ol className="sticky top-24 space-y-0.5">
            {proposal.sections.map((s) => (
              <li key={s.key}>
                <a href={`#edit-${s.key}`} className={`block rounded-md px-2.5 py-1.5 text-sm hover:bg-slate-100 ${s.hidden ? "text-slate-400 line-through" : "text-slate-700"}`}>
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="cxp-scope space-y-4">
          {proposal.sections.map((s) => (
            <SectionCard
              key={s.key}
              section={s}
              locked={locked}
              editing={editing === s.key}
              onEdit={() => setEditing(s.key)}
              onCancel={() => setEditing(null)}
              onSave={async (next) => {
                const ok = await setSection(s.key, next);
                if (ok) setEditing(null);
                return ok;
              }}
              onToggle={() => void setSection(s.key, { hidden: !s.hidden })}
            />
          ))}
          <p className="text-xs text-slate-500">
            They sign at the end, under &ldquo;Accept and sign&rdquo;. Sections you hide, or leave empty, don&apos;t show.
          </p>
        </div>
      </div>
    </div>
  );
}

function ProspectDetails({ proposal, locked, onSave }: { proposal: Proposal; locked: boolean; onSave: (patch: Record<string, unknown>) => Promise<boolean> }) {
  const initial = {
    prospect_name: proposal.prospect_name,
    prospect_business: proposal.prospect_business ?? "",
    prospect_email: proposal.prospect_email ?? "",
  };
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const changed = JSON.stringify(form) !== JSON.stringify(initial);
  const input =
    "mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-100 disabled:bg-slate-50";
  return (
    <div className="mt-6 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
      <label className="text-xs font-medium text-slate-600">
        Their name
        <input id="pd-name" className={input} value={form.prospect_name} disabled={locked} onChange={(e) => setForm({ ...form, prospect_name: e.target.value })} />
      </label>
      <label className="text-xs font-medium text-slate-600">
        Their business
        <input id="pd-business" className={input} value={form.prospect_business} disabled={locked} onChange={(e) => setForm({ ...form, prospect_business: e.target.value })} />
      </label>
      <label className="text-xs font-medium text-slate-600">
        Their email
        <input id="pd-email" type="email" className={input} value={form.prospect_email} disabled={locked} onChange={(e) => setForm({ ...form, prospect_email: e.target.value })} />
      </label>
      <button
        type="button"
        disabled={!changed || saving || locked}
        onClick={async () => {
          setSaving(true);
          await onSave(form);
          setSaving(false);
        }}
        className="h-9 rounded-full bg-[#0c5290] px-4 text-sm font-semibold text-white hover:bg-[#08396a] disabled:opacity-40"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}

function SectionCard({
  section,
  locked,
  editing,
  onEdit,
  onCancel,
  onSave,
  onToggle,
}: {
  section: ProposalSection;
  locked: boolean;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (next: Partial<ProposalSection>) => Promise<boolean>;
  onToggle: () => void;
}) {
  const [title, setTitle] = useState(section.title);
  const [body, setBody] = useState(section.body);
  const [saving, setSaving] = useState(false);
  const empty = !section.body.trim();
  const small = "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold";

  let content: ReactNode;
  if (editing) {
    content = (
      <div className="space-y-3">
        <label className="block text-xs font-medium text-slate-600">
          Heading
          <input
            id={`title-${section.key}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-base font-semibold text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-100"
          />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          What they read
          <textarea
            id={`body-${section.key}`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={Math.min(24, Math.max(6, body.split("\n").length + 2))}
            placeholder={EMPTY_HINT[section.key]}
            className="mt-1 block w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 text-[0.9375rem] leading-relaxed text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-100"
          />
        </label>
        <p className="text-xs text-slate-500">A blank line starts a new paragraph. Start a line with ## for a small heading, or - for a ticked point.</p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={saving || !title.trim()}
            onClick={async () => {
              setSaving(true);
              await onSave({ title: title.trim(), body });
              setSaving(false);
            }}
            className={`${small} bg-[#0c5290] text-white hover:bg-[#08396a] disabled:opacity-50`}
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => {
              setTitle(section.title);
              setBody(section.body);
              onCancel();
            }}
            className={`${small} text-slate-600 hover:text-slate-900`}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  } else if (empty) {
    content = <p className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">{EMPTY_HINT[section.key] ?? "Nothing here yet. It won't show until you add something."}</p>;
  } else {
    content = <ProposalBody body={section.body} />;
  }

  return (
    <section id={`edit-${section.key}`} className={`scroll-mt-24 rounded-xl border bg-white p-5 sm:p-6 ${section.hidden ? "border-dashed border-slate-300 opacity-60" : "border-slate-200"}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold tracking-tight text-slate-900">{section.title}</h3>
        {locked || editing ? null : (
          <div className="flex gap-1">
            <button type="button" onClick={onToggle} className={`${small} text-slate-600 hover:bg-slate-100`} aria-pressed={!section.hidden}>
              {section.hidden ? <EyeOff className="h-3.5 w-3.5" aria-hidden /> : <Eye className="h-3.5 w-3.5" aria-hidden />}
              {section.hidden ? "Hidden" : "Showing"}
            </button>
            <button type="button" onClick={onEdit} className={`${small} border border-slate-200 text-slate-700 hover:border-slate-300`}>
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              Edit
            </button>
          </div>
        )}
      </div>
      {content}
    </section>
  );
}
