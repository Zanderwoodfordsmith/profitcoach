"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Check, Loader2, MessageCircle, Pencil, RotateCw, Sparkles } from "lucide-react";

import {
  SECTION_SOURCES,
  fieldValue,
  sectionByKey,
  sectionState,
  type FieldSpec,
  type SectionRef,
} from "@/lib/practiceKnowledge/blueprint";
import { blocksToMarkdown } from "@/lib/practiceKnowledge/blocks";
import { formatFieldValue } from "@/lib/practiceKnowledge/exportMarkdown";
import { STANDARD_SECTIONS } from "@/lib/practiceKnowledge/standard";

import { usePractice } from "../PracticeProvider";
import { Blocks } from "./Blocks";

const SOURCE_DOT: Record<string, string> = {
  imported: "bg-[#c99a2e]",
  from_you: "bg-[var(--bp-sky)]",
  we_build: "bg-[#6d4fd6]",
  standard: "bg-[#8595a8]",
  live: "bg-[#1f9d6b]",
};

function formatDate(iso: string | undefined | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function FieldEditor({ field, onDone }: { field: FieldSpec; onDone: () => void }) {
  const { payload, saveField } = usePractice();
  const current = payload ? fieldValue(payload, field.path)?.value : null;
  const [value, setValue] = useState(() =>
    field.kind === "list" ? ((current as string[] | null) ?? []).join("\n") : String(current ?? "")
  );
  const inputClass =
    "w-full rounded-lg border border-[var(--bp-rule)] bg-white px-3 py-2 text-[0.9375rem] text-[var(--bp-ink)] outline-none focus:border-[var(--bp-sky)] focus:ring-2 focus:ring-[#cfe6f8]";

  function save() {
    if (field.kind === "list") {
      saveField(field, value.split("\n").map((v) => v.trim()).filter(Boolean));
    } else if (value.trim()) {
      saveField(field, value.trim());
    }
    onDone();
  }

  return (
    <div className="space-y-2">
      {field.kind === "enum" ? (
        <select className={inputClass} value={value} onChange={(e) => setValue(e.target.value)}>
          <option value="">Choose…</option>
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : field.kind === "list" ? (
        <textarea
          className={`${inputClass} min-h-24`}
          value={value}
          placeholder="One per line"
          onChange={(e) => setValue(e.target.value)}
        />
      ) : (
        <textarea className={`${inputClass} min-h-11`} rows={2} value={value} onChange={(e) => setValue(e.target.value)} />
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          className="rounded-full bg-[var(--bp-navy)] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--bp-blue)]"
        >
          Save
        </button>
        <button type="button" onClick={onDone} className="rounded-full px-3 py-1.5 text-xs font-semibold text-[var(--bp-muted)] hover:bg-[var(--bp-tint)]">
          Cancel
        </button>
      </div>
    </div>
  );
}

function Fields({ refKey }: { refKey: string }) {
  const { payload, setAssistantOpen, readOnly } = usePracticeReadOnly();
  const [editing, setEditing] = useState<string | null>(null);
  const ref = sectionByKey(refKey);
  if (!ref || !payload) return null;
  const fields = ref.section.fields ?? [];

  return (
    <dl className="grid gap-x-8 gap-y-4 @xl:grid-cols-[minmax(8rem,12rem)_1fr]">
      {fields.map((field) => {
        const values = formatFieldValue(payload, field);
        const editable = !readOnly && field.kind !== "results" && field.kind !== "stories";
        return (
          <div key={field.path} className="contents">
            <dt className="pt-0.5 text-[0.8125rem] font-semibold text-[var(--bp-muted)]">
              {field.label}
              {field.required ? null : <span className="font-normal text-[var(--bp-faint)]"> · optional</span>}
            </dt>
            <dd className="group min-w-0">
              {editing === field.path ? (
                <FieldEditor field={field} onDone={() => setEditing(null)} />
              ) : values.length ? (
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1 space-y-1.5 text-[1.0078rem] leading-[1.6] text-[var(--bp-ink)]">
                    {values.map((v, i) => (
                      <p key={i}>{v}</p>
                    ))}
                  </div>
                  {editable ? (
                    <button
                      type="button"
                      onClick={() => setEditing(field.path)}
                      aria-label={`Edit ${field.label}`}
                      className="bp-no-print rounded-md p-1 text-[var(--bp-faint)] opacity-0 transition-opacity hover:bg-[var(--bp-tint)] hover:text-[var(--bp-blue)] focus:opacity-100 group-hover:opacity-100"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#fff4e0] px-2.5 py-0.5 text-xs font-semibold text-[#8a5300]">Still open</span>
                  {readOnly ? null : (
                    <>
                      {field.ask ? (
                        <button
                          type="button"
                          onClick={() => setAssistantOpen(true)}
                          className="bp-no-print inline-flex items-center gap-1 text-xs font-semibold text-[var(--bp-blue)] hover:underline"
                        >
                          <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                          Tell us
                        </button>
                      ) : null}
                      {editable ? (
                        <button
                          type="button"
                          onClick={() => setEditing(field.path)}
                          className="bp-no-print text-xs font-semibold text-[var(--bp-muted)] hover:text-[var(--bp-blue)] hover:underline"
                        >
                          Type it in
                        </button>
                      ) : null}
                    </>
                  )}
                </div>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/** usePractice plus a read-only flag (admin records and exports reuse these views). */
function usePracticeReadOnly() {
  const ctx = usePractice();
  return { ...ctx, readOnly: false };
}

function WriteButton({ refKey, label }: { refKey: string; label: string }) {
  const { build, building } = usePractice();
  const busy = building.active.length > 0;
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => build(refKey)}
      className="bp-no-print inline-flex items-center gap-1.5 rounded-full bg-[var(--bp-navy)] px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--bp-blue)] disabled:cursor-not-allowed disabled:opacity-45"
    >
      <Sparkles className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
  );
}

function SendToCampaigns() {
  const { sendCampaign, href } = usePractice();
  const [state, setState] = useState<{ busy?: string; done?: { id: string; label: string }; error?: string }>({});

  async function send(variant: "connector" | "conversation", label: string) {
    setState({ busy: variant });
    const res = await sendCampaign(variant);
    setState(res.campaignId ? { done: { id: res.campaignId, label } } : { error: res.error });
  }

  return (
    <div className="bp-no-print bp-tinted mt-8 rounded-2xl bg-[var(--bp-tint)] px-5 py-4">
      <p className="text-[0.9375rem] font-semibold text-[var(--bp-ink)]">Send to Get Clients</p>
      <p className="mt-1 text-sm leading-6 text-[var(--bp-muted)]">
        Creates a draft campaign with these messages and the timings above. Nothing sends until prospects are added and the campaign is started.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={Boolean(state.busy)}
          onClick={() => void send("connector", "Connector campaign")}
          className="rounded-full bg-[var(--bp-navy)] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--bp-blue)] disabled:opacity-50"
        >
          {state.busy === "connector" ? "Creating…" : "Connector campaign"}
        </button>
        <button
          type="button"
          disabled={Boolean(state.busy)}
          onClick={() => void send("conversation", "Scorecard conversation")}
          className="rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-[var(--bp-ink)] ring-1 ring-[var(--bp-rule)] hover:ring-[var(--bp-sky)] disabled:opacity-50"
        >
          {state.busy === "conversation" ? "Creating…" : "Scorecard conversation"}
        </button>
        {state.done ? (
          <Link
            href={href(`/coach/campaigns/${state.done.id}`)}
            className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--bp-blue)] hover:underline"
          >
            {state.done.label} created. Open it
            <ArrowUpRight className="h-4 w-4" aria-hidden />
          </Link>
        ) : null}
        {state.error ? <span className="text-sm text-[#9b1c1c]">{state.error}</span> : null}
      </div>
    </div>
  );
}

function Built({ refKey }: { refKey: string }) {
  const { knowledge, building, build } = usePractice();
  const ref = sectionByKey(refKey);
  const built = knowledge?.built_sections[refKey];
  const writing = building.active.includes(refKey);
  const queued = building.queue.includes(refKey);

  if (writing) {
    return (
      <div className="space-y-3" aria-live="polite">
        <p className="inline-flex items-center gap-2 text-sm font-medium text-[var(--bp-blue)]">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Writing this section from your blueprint…
        </p>
        <div className="space-y-2.5">
          {[92, 100, 76, 88].map((w, i) => (
            <div key={i} className="h-3 animate-pulse rounded-full bg-[var(--bp-tint-strong)]" style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>
    );
  }

  if (!built) {
    const needs = (ref?.section.needs ?? [])
      .filter((k) => !knowledge?.built_sections[k])
      .map((k) => sectionByKey(k)?.section.title)
      .filter(Boolean);
    return (
      <div className="bp-tinted rounded-2xl border border-dashed border-[#c7d7e8] bg-[var(--bp-tint)] px-5 py-5">
        <p className="text-[0.9375rem] font-semibold text-[var(--bp-ink)]">
          {queued ? "Queued. BCA writes this next." : "Not written yet."}
        </p>
        <p className="mt-1 text-sm leading-6 text-[var(--bp-muted)]">
          Built from {ref?.section.from?.join(", ").toLowerCase() || "your blueprint"}.
          {needs.length ? ` Best written after ${needs.join(" and ").toLowerCase()}.` : ""}
        </p>
        {queued ? null : (
          <div className="mt-3">
            <WriteButton refKey={refKey} label="Write this section" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bp-written">
      <Blocks blocks={built.blocks} />
      {refKey === "campaigns:messaging" ? <SendToCampaigns /> : null}
      <div className="bp-no-print mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--bp-rule)] pt-3 text-xs text-[var(--bp-faint)]">
        <span>Written by BCA {formatDate(built.generated_at)}</span>
        <button
          type="button"
          disabled={building.active.length > 0}
          onClick={() => build(refKey)}
          className="inline-flex items-center gap-1 font-semibold text-[var(--bp-muted)] hover:text-[var(--bp-blue)] disabled:opacity-40"
        >
          <RotateCw className="h-3.5 w-3.5" aria-hidden />
          Rewrite
        </button>
        <button
          type="button"
          onClick={() => void navigator.clipboard?.writeText(blocksToMarkdown(built.blocks, 3))}
          className="font-semibold text-[var(--bp-muted)] hover:text-[var(--bp-blue)]"
        >
          Copy as text
        </button>
      </div>
    </div>
  );
}

export function SectionView({ sectionRef }: { sectionRef: SectionRef }) {
  const { knowledge, payload, approveSection, href } = usePractice();
  const { section, key } = sectionRef;
  if (!knowledge || !payload) return null;
  const row = { ...knowledge, payload };
  const state = sectionState(sectionRef, row);
  const approved = Boolean(payload.review.approved_sections?.value?.[key]);
  const canApprove = section.source !== "live" && section.source !== "standard" && state === "ready";

  const stateLabel =
    state === "open"
      ? "Needs you"
      : state === "building"
        ? "Not written yet"
        : state === "live"
          ? "Fills when live"
          : approved
            ? "Approved"
            : section.source === "standard"
              ? "BCA standard"
              : "Ready to review";

  return (
    <section id={`s-${key.replace(":", "-")}`} className="bp-section scroll-mt-24">
      <header className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <h3 className="min-w-0 text-[1.3125rem] font-semibold leading-snug tracking-[-0.02em] text-[var(--bp-ink)]">
            {section.title}
          </h3>
          {canApprove ? (
            <button
              type="button"
              aria-pressed={approved}
              onClick={() => approveSection(key)}
              className={`bp-no-print inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                approved
                  ? "bg-[var(--bp-navy)] text-white"
                  : "bg-white text-[var(--bp-ink)] ring-1 ring-[var(--bp-rule)] hover:ring-[var(--bp-sky)]"
              }`}
            >
              {approved ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
              {approved ? "Approved" : "Approve"}
            </button>
          ) : null}
        </div>
        <div className="bp-rule-short mt-2.5" />
        <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--bp-muted)]">
          <span className="inline-flex items-center gap-1.5 font-semibold" title={SECTION_SOURCES[section.source].hint}>
            <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${SOURCE_DOT[section.source]}`} />
            {SECTION_SOURCES[section.source].label}
          </span>
          <span aria-hidden className="text-[var(--bp-rule)]">/</span>
          <span className={state === "open" ? "font-semibold text-[#8a5300]" : undefined}>{stateLabel}</span>
        </p>
      </header>

      {section.source === "imported" || section.source === "from_you" ? (
        <Fields refKey={key} />
      ) : section.source === "we_build" ? (
        <Built refKey={key} />
      ) : section.source === "standard" ? (
        STANDARD_SECTIONS[key] ? <Blocks blocks={STANDARD_SECTIONS[key]} /> : null
      ) : (
        <div className="bp-tinted flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#effaf5] px-5 py-4">
          <p className="text-sm leading-6 text-[#1d5a43]">
            {SECTION_SOURCES.live.hint} Nothing here is invented.
          </p>
          {section.link ? (
            <Link
              href={href(section.link.href)}
              className="bp-no-print inline-flex items-center gap-1 text-sm font-semibold text-[#146b4b] hover:underline"
            >
              {section.link.label}
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </Link>
          ) : null}
        </div>
      )}
    </section>
  );
}
