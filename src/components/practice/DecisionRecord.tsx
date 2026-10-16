"use client";

import { useState } from "react";
import { Lock, Pencil } from "lucide-react";

import { DECISION_FIELDS, DECISION_GROUPS, proposedDecision } from "@/lib/practiceKnowledge/decisionDefaults";
import type { DecisionRecordPayload } from "@/lib/practiceKnowledge/types";

import { InfoTip } from "./document/InfoTip";
import { usePractice } from "./PracticeProvider";

function formatDate(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * The Decision Record as the first page of the blueprint. Before the call it
 * shows what BCA proposes. On the call an admin fills it in here and locks it.
 * Everything else in the blueprint is written from it.
 */
export function DecisionRecordView() {
  const { knowledge, payload, decision, canEditDecision, saveDecision } = usePractice();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<DecisionRecordPayload | null>(null);
  const [saving, setSaving] = useState(false);
  if (!knowledge || !payload) return null;

  const row = { ...knowledge, payload };
  const proposed = proposedDecision(row);
  const locked = Boolean(decision?.locked_at);
  // A saved record wins. Anything it leaves empty falls back to the proposal until the call is locked.
  const values: DecisionRecordPayload = decision
    ? locked
      ? decision.payload
      : Object.fromEntries(
          DECISION_FIELDS.map((f) => [f.key, decision.payload[f.key]?.trim() || proposed[f.key]])
        ) as DecisionRecordPayload
    : proposed;
  const anything = DECISION_FIELDS.some((f) => values[f.key]?.trim());
  const booked = payload.review.decision_call_booked_at?.value;

  const status = locked
    ? `Agreed on your Decision Call, ${formatDate(decision?.locked_at)}. Everything in this blueprint is written from these.`
    : decision
      ? "A draft from your Decision Call. BCA locks it once everything is agreed."
      : anything
        ? `What BCA proposes. We agree these together on your Decision Call${booked ? `, booked for ${formatDate(booked)}` : ""}.`
        : "These are agreed on your Decision Call. BCA proposes each one first, from what you tell us.";

  async function save(lock: boolean) {
    if (!draft) return;
    setSaving(true);
    const ok = await saveDecision(draft, lock);
    setSaving(false);
    if (ok) setEditing(false);
  }

  return (
    <div className="space-y-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p
          className={`bp-tinted flex max-w-[60ch] items-start gap-2.5 rounded-xl px-4 py-3 text-[0.9375rem] leading-[1.6] ${
            locked ? "bg-[var(--bp-navy)] text-white" : "bg-[#eef6fd] text-[#0b3f6b]"
          }`}
        >
          {locked ? <Lock className="mt-1 h-4 w-4 shrink-0" aria-hidden /> : null}
          {status}
        </p>
        {canEditDecision && !editing ? (
          <button
            type="button"
            onClick={() => {
              setDraft({ ...values });
              setEditing(true);
            }}
            className="bp-no-print inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-sm font-semibold text-[var(--bp-ink)] ring-1 ring-[var(--bp-rule)] hover:ring-[var(--bp-sky)]"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            {locked ? "Change the record" : "Fill in on the call"}
          </button>
        ) : null}
      </div>

      {DECISION_GROUPS.map((group) => (
        <section key={group.label} className="bp-keep">
          <h3 className="text-[1.25rem] font-semibold tracking-[-0.02em] text-[var(--bp-ink)]">{group.label}</h3>
          <dl className="mt-4 grid gap-x-6 gap-y-3 @xl:grid-cols-[minmax(8rem,11rem)_1fr]">
            {group.fields.map((field) => {
              const value = values[field.key]?.trim();
              const isProposal = !locked && value && !decision?.payload[field.key]?.trim();
              return (
                <div key={field.key} className="contents">
                  <dt className="flex items-center gap-1 pt-2.5 text-[0.8125rem] font-semibold text-[var(--bp-muted)]">
                    {field.label}
                    <InfoTip label={field.label}>{field.help}</InfoTip>
                  </dt>
                  <dd className="min-w-0">
                    {editing && draft ? (
                      <textarea
                        value={draft[field.key]}
                        placeholder={`e.g. ${field.example}`}
                        rows={Math.max(1, Math.ceil((draft[field.key]?.length ?? 0) / 70))}
                        onChange={(e) => setDraft((d) => (d ? { ...d, [field.key]: e.target.value } : d))}
                        className="w-full resize-y rounded-xl border border-[#cdd8e4] bg-white px-3.5 py-2.5 text-[0.9844rem] leading-[1.6] text-[var(--bp-ink)] outline-none focus:border-[var(--bp-sky)] focus:ring-2 focus:ring-[#cfe6f8]"
                      />
                    ) : value ? (
                      <p className="bp-tinted rounded-xl bg-[#f3f5f8] px-3.5 py-2.5 text-[0.9844rem] leading-[1.6] text-[var(--bp-ink)]">
                        {value}
                        {isProposal ? (
                          <span className="ml-2 align-middle text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-[var(--bp-faint)]">
                            Proposed
                          </span>
                        ) : null}
                      </p>
                    ) : (
                      <p className="bp-tinted rounded-xl border border-dashed border-[#d3dae3] bg-[#f8f9fb] px-3.5 py-2.5 text-[0.9844rem] leading-[1.6] text-[var(--bp-faint)]">
                        e.g. {field.example}
                      </p>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
      ))}

      {editing ? (
        <div className="bp-no-print sticky bottom-3 z-10 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void save(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--bp-navy)] px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_-14px_rgba(5,30,54,0.8)] hover:bg-[var(--bp-blue)] disabled:opacity-50"
          >
            <Lock className="h-3.5 w-3.5" aria-hidden />
            {saving ? "Saving…" : "Lock the record"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save(false)}
            className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-[var(--bp-ink)] ring-1 ring-[var(--bp-rule)] hover:ring-[var(--bp-sky)] disabled:opacity-50"
          >
            Save as draft
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-full px-4 py-2 text-sm font-semibold text-[var(--bp-muted)] hover:text-[var(--bp-ink)]"
          >
            Cancel
          </button>
        </div>
      ) : null}
    </div>
  );
}
