"use client";

import { useState } from "react";
import { Lock, Pencil } from "lucide-react";

import { badgeClass } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import { fieldClass } from "@/components/ui/Field";
import { DECISION_FIELDS, DECISION_GROUPS, proposedDecision } from "@/lib/practiceKnowledge/decisionDefaults";
import type { DecisionRecordPayload } from "@/lib/practiceKnowledge/types";

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
      ? "A draft from your Decision Call."
      : anything
        ? `What BCA proposes. We agree these together on your Decision Call${booked ? `, booked for ${formatDate(booked)}` : ""}.`
        : "These are agreed on your Decision Call. BCA proposes each one first, from what you tell us.";

  async function save() {
    if (!draft) return;
    setSaving(true);
    const ok = await saveDecision(draft, false);
    setSaving(false);
    if (ok) setEditing(false);
  }

  // Who does what and open risks are for the call, not the coach's page.
  const groups = DECISION_GROUPS.filter((group) => group.label !== "Who does what");

  return (
    <div className="space-y-6">
      <p className="max-w-[60ch] text-read text-[var(--bp-muted)]">{status}</p>

      {groups.map((group, index) => (
        <section key={group.label} className={cardClass("plain", "bp-keep bp-block overflow-hidden")}>
          <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-[#eef1f5] px-5 py-3">
            <h3 className="text-subhead font-semibold text-[var(--bp-ink)]">{group.label}</h3>
            <div className="bp-no-print flex items-center gap-2">
              <span
                className={badgeClass(locked ? "green" : anything ? "blue" : "grey")}
              >
                {locked ? <Lock className="h-3 w-3" aria-hidden /> : null}
                {locked ? "Agreed" : anything ? "Proposed by BCA" : "With BCA"}
              </span>
              {canEditDecision && !editing && index === 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setDraft({ ...values });
                    setEditing(true);
                  }}
                  className={buttonClass("quiet", "small")}
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                  Edit
                </button>
              ) : null}
            </div>
          </header>
          <dl className="divide-y divide-[#eef1f5] px-5">
            {group.fields.map((field) => {
              const value = values[field.key]?.trim();
              return (
                <div key={field.key} className="grid gap-x-8 gap-y-1.5 py-4 @xl:grid-cols-[minmax(11rem,15rem)_1fr]">
                  <dt>
                    <span className="block text-ui font-medium text-[var(--bp-ink)]">{field.label}</span>
                    <span className="mt-0.5 block text-sm leading-5 text-[var(--bp-muted)]">{field.help}</span>
                  </dt>
                  <dd className="min-w-0">
                    {editing && draft ? (
                      <textarea
                        value={draft[field.key]}
                        placeholder={`e.g. ${field.example}`}
                        rows={Math.max(1, Math.ceil((draft[field.key]?.length ?? 0) / 60))}
                        onChange={(e) => setDraft((d) => (d ? { ...d, [field.key]: e.target.value } : d))}
                        className={fieldClass("textarea", "normal", "resize-y")}
                      />
                    ) : value ? (
                      <p className="bp-tinted rounded-xl bg-[#f3f5f8] px-3.5 py-2.5 text-read text-[var(--bp-ink)]">{value}</p>
                    ) : (
                      <p className="rounded-xl border border-dashed border-[#d3dae3] px-3.5 py-2.5 text-read text-[var(--bp-faint)]">
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
            onClick={() => void save()}
            className={buttonClass("main")}
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className={buttonClass("quiet")}
          >
            Cancel
          </button>
        </div>
      ) : null}
    </div>
  );
}
