"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Check, ChevronDown, Lightbulb, Loader2, MessageCircle, Pencil, RotateCw, Sparkles } from "lucide-react";

import {
  fieldValue,
  sectionByKey,
  sectionState,
  type BlueprintSection,
  type FieldSpec,
  type SectionRef,
} from "@/lib/practiceKnowledge/blueprint";
import { blocksToMarkdown } from "@/lib/practiceKnowledge/blocks";
import { formatFieldValue } from "@/lib/practiceKnowledge/exportMarkdown";

import { usePractice } from "../PracticeProvider";
import { BlockEditor } from "./BlockEditor";
import { Blocks } from "./Blocks";
import { InfoTip } from "./InfoTip";

function formatDate(iso: string | undefined | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** What a section is for, and where it comes from and goes. Shown behind the info icon. */
function SectionAbout({ section }: { section: BlueprintSection }) {
  return (
    <>
      {section.about ? <span className="block">{section.about}</span> : null}
      {section.from?.length ? (
        <span className="block text-white/75">
          <span className="font-semibold text-white">Built from:</span> {section.from.join(", ")}
        </span>
      ) : null}
      {section.feeds ? (
        <span className="block text-white/75">
          <span className="font-semibold text-white">Used for:</span> {section.feeds}
        </span>
      ) : null}
    </>
  );
}

const SOURCE_TAG: Record<string, string> = {
  linkedin: "From LinkedIn",
  form: "From sign-up",
  interview: "From the conversation",
};

/** The empty-box hint: the example (lists one per line become a comma list), or a fixed placeholder. */
function hint(field: FieldSpec): string {
  if (field.placeholder) return field.placeholder;
  return field.example ? `e.g. ${field.example.split("\n").join(", ")}` : "Type here";
}

/** Long imported text (a LinkedIn About) folds to a few lines until opened. */
const LONG = 420;

/** The look of something the coach fills in: a white box with an edge, like a form field. */
const INPUT_BOX =
  "w-full rounded-xl border border-[#cdd8e4] bg-white px-3.5 py-2.5 text-left text-[0.9844rem] leading-[1.6] text-[var(--bp-ink)] shadow-[inset_0_1px_2px_rgba(5,30,54,0.05)]";

function FieldEditor({ field, onDone }: { field: FieldSpec; onDone: () => void }) {
  const { payload, saveField } = usePractice();
  const current = payload ? fieldValue(payload, field.path)?.value : null;
  const [value, setValue] = useState(() =>
    field.kind === "list" ? ((current as string[] | null) ?? []).join("\n") : String(current ?? "")
  );

  function save() {
    if (field.kind === "list") {
      saveField(field, value.split("\n").map((v) => v.trim()).filter(Boolean));
    } else if (value.trim()) {
      saveField(field, value.trim());
    }
    onDone();
  }

  const rows = field.kind === "text" ? 1 : Math.min(14, Math.max(3, value.split("\n").length + Math.floor(value.length / 80)));
  return (
    <div className="space-y-2">
      <textarea
        autoFocus
        className={`${INPUT_BOX} resize-y border-[var(--bp-sky)] outline-none ring-2 ring-[#cfe6f8]`}
        rows={rows}
        value={value}
        placeholder={hint(field)}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onDone();
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey || field.kind === "text")) {
            e.preventDefault();
            save();
          }
        }}
      />
      <div className="flex items-center gap-2">
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
        {field.kind === "list" ? <span className="text-xs text-[var(--bp-faint)]">One per line</span> : null}
      </div>
    </div>
  );
}

function EnumBox({ field }: { field: FieldSpec }) {
  const { payload, saveField } = usePractice();
  const current = payload ? String(fieldValue(payload, field.path)?.value ?? "") : "";
  return (
    <div className="relative">
      <select
        aria-label={field.label}
        value={current}
        onChange={(e) => {
          if (e.target.value) saveField(field, e.target.value);
        }}
        className={`${INPUT_BOX} appearance-none pr-10 outline-none hover:border-[var(--bp-sky)] focus:border-[var(--bp-sky)] focus:ring-2 focus:ring-[#cfe6f8] ${
          current ? "" : "text-[var(--bp-faint)]"
        }`}
      >
        <option value="">Choose…</option>
        {field.options?.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--bp-faint)]" aria-hidden />
    </div>
  );
}

function Field({ field }: { field: FieldSpec }) {
  const { payload, setAssistantOpen, sample } = usePractice();
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  if (!payload) return null;
  const values = formatFieldValue(payload, field);
  const long = values.join("\n").length > LONG;
  const filled = values.length > 0;
  const source = fieldValue(payload, field.path)?.source;
  // Results and stories have structure (from, to, timeframe), so the conversation captures them.
  const structured = field.kind === "results" || field.kind === "stories";

  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1">
        <span className="text-[0.8125rem] font-semibold text-[var(--bp-muted)]">{field.label}</span>
        {field.help ? <InfoTip label={field.label}>{field.help}</InfoTip> : null}
        {!filled && field.required ? (
          <span className="rounded-full bg-[#fff4e0] px-2 py-px text-[0.6875rem] font-semibold text-[#8a5300]">Needed</span>
        ) : null}
        {filled && source && SOURCE_TAG[source] ? (
          <span className="text-[0.6875rem] font-medium text-[var(--bp-faint)]">{SOURCE_TAG[source]}</span>
        ) : null}
      </div>

      {field.kind === "enum" ? (
        <EnumBox field={field} />
      ) : editing ? (
        <FieldEditor field={field} onDone={() => setEditing(false)} />
      ) : structured ? (
        <div className={INPUT_BOX}>
          {filled ? (
            <ul className="space-y-1.5">
              {values.map((v, i) => (
                <li key={i}>{v}</li>
              ))}
            </ul>
          ) : (
            <p className="text-[var(--bp-faint)]">{hint(field)}</p>
          )}
          {sample ? null : (
            <button
              type="button"
              onClick={() => setAssistantOpen(true)}
              className="bp-no-print mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--bp-blue)] hover:underline"
            >
              <MessageCircle className="h-3.5 w-3.5" aria-hidden />
              {filled ? "Add another in the conversation" : "Tell us in the conversation"}
            </button>
          )}
        </div>
      ) : (
        <>
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={`Edit ${field.label}`}
          className={`${INPUT_BOX} group block cursor-text transition-colors hover:border-[var(--bp-sky)] focus-visible:border-[var(--bp-sky)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cfe6f8]`}
        >
          {filled ? (
            <span
              className={`block space-y-1 ${
                long && !expanded
                  ? "max-h-[8.5rem] overflow-hidden [mask-image:linear-gradient(to_bottom,black_55%,transparent)]"
                  : ""
              }`}
            >
              {values.map((v, i) => (
                <span key={i} className="block whitespace-pre-line">
                  {v}
                </span>
              ))}
            </span>
          ) : (
            <span className="block text-[var(--bp-faint)]">{hint(field)}</span>
          )}
        </button>
        {long ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="bp-no-print mt-1.5 text-xs font-semibold text-[var(--bp-blue)] hover:underline"
          >
            {expanded ? "Show less" : "Show all"}
          </button>
        ) : null}
        </>
      )}
    </div>
  );
}

function Fields({ section }: { section: BlueprintSection }) {
  const fields = section.fields ?? [];
  const wide = (f: FieldSpec) => f.kind === "longtext" || f.kind === "results" || f.kind === "stories";
  return (
    <div className="grid gap-x-5 gap-y-5 @xl:grid-cols-2">
      {fields.map((field) => (
        <div key={field.path} className={wide(field) || fields.length === 1 ? "@xl:col-span-2" : undefined}>
          <Field field={field} />
        </div>
      ))}
    </div>
  );
}

function WriteButton({ refKey, label }: { refKey: string; label: string }) {
  const { build, building, sample } = usePractice();
  const busy = building.active.length > 0;
  if (sample) return null;
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
  const { sendCampaign, href, sample } = usePractice();
  const [state, setState] = useState<{ busy?: string; done?: { id: string; label: string }; error?: string }>({});
  if (sample) return null;

  async function send(variant: "connector" | "conversation", label: string) {
    setState({ busy: variant });
    const res = await sendCampaign(variant);
    setState(res.campaignId ? { done: { id: res.campaignId, label } } : { error: res.error });
  }

  return (
    <div className="bp-no-print mt-6 rounded-xl border border-[var(--bp-rule)] bg-white px-5 py-4">
      <p className="text-[0.9375rem] font-semibold text-[var(--bp-ink)]">Happy with it? Send it to Get Clients</p>
      <p className="mt-1 text-sm leading-6 text-[var(--bp-muted)]">
        Creates a draft campaign with these messages and timings. From then on, change it in Get Clients, not here.
        Nothing sends until prospects are added and the campaign is started.
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

/** The look of something BCA wrote: a soft grey panel. Edits are one click away, but quiet. */
function Output({ refKey, section }: { refKey: string; section: BlueprintSection }) {
  const { knowledge, building, build, editMessage, saveBlocks, href } = usePractice();
  const [editing, setEditing] = useState(false);
  const built = knowledge?.built_sections[refKey];
  const writing = building.active.includes(refKey);
  const queued = building.queue.includes(refKey);
  const panel = "bp-tinted bp-output rounded-2xl bg-[#f3f5f8] px-5 py-5 @2xl:px-7 @2xl:py-6";

  if (writing) {
    return (
      <div className={panel} aria-live="polite">
        <p className="inline-flex items-center gap-2 text-sm font-medium text-[var(--bp-blue)]">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Writing this from your blueprint…
        </p>
        <div className="mt-4 space-y-2.5">
          {[92, 100, 76, 88].map((w, i) => (
            <div key={i} className="h-3 animate-pulse rounded-full bg-[#e2e7ee]" style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>
    );
  }

  if (!built) {
    const needs = (section.needs ?? [])
      .filter((k) => !knowledge?.built_sections[k])
      .map((k) => sectionByKey(k)?.section.title)
      .filter(Boolean);
    return (
      <div className={`${panel} border border-dashed border-[#d3dae3]`}>
        <p className="inline-flex items-center gap-2 text-[0.9375rem] font-semibold text-[var(--bp-ink)]">
          <Sparkles className="h-4 w-4 text-[var(--bp-faint)]" aria-hidden />
          {queued ? "Queued. BCA writes this next." : "BCA writes this for you."}
        </p>
        <p className="mt-1 text-sm leading-6 text-[var(--bp-muted)]">
          From {section.from?.join(", ").toLowerCase() || "your blueprint"}.
          {needs.length ? ` Best written after ${needs.join(" and ").toLowerCase()}.` : ""}
        </p>
        {queued ? null : (
          <div className="mt-3">
            <WriteButton refKey={refKey} label="Write it now" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={panel}>
      <div className="bp-no-print mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-[var(--bp-faint)]">
        <span className="inline-flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Written by BCA {formatDate(built.generated_at)}
          {built.edited_at ? `, edited ${formatDate(built.edited_at)}` : ""}
        </span>
        {editing ? null : (
          <span className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1 font-semibold text-[var(--bp-muted)] hover:text-[var(--bp-blue)]"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              Edit
            </button>
            <button
              type="button"
              disabled={building.active.length > 0}
              onClick={() => {
                if (built.edited_at && !window.confirm("Rewriting replaces your edits to this section. Carry on?")) return;
                build(refKey);
              }}
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
              Copy
            </button>
          </span>
        )}
      </div>
      {editing ? (
        <BlockEditor blocks={built.blocks} onSave={(blocks) => saveBlocks(refKey, blocks)} onCancel={() => setEditing(false)} />
      ) : (
        <Blocks blocks={built.blocks} onSaveMessage={(index, body) => editMessage(refKey, index, body)} />
      )}
      {refKey === "campaigns:messaging" && !editing ? <SendToCampaigns /> : null}
      {section.link && !editing ? (
        <p className="bp-no-print mt-5 border-t border-[#e1e6ec] pt-3 text-sm">
          <Link href={href(section.link.href)} className="inline-flex items-center gap-1 font-semibold text-[var(--bp-blue)] hover:underline">
            {section.link.label}
            <ArrowUpRight className="h-4 w-4" aria-hidden />
          </Link>
        </p>
      ) : null}
    </div>
  );
}

export function SectionView({ sectionRef }: { sectionRef: SectionRef }) {
  const { knowledge, payload, approveSection } = usePractice();
  const { section, key } = sectionRef;
  if (!knowledge || !payload) return null;
  const row = { ...knowledge, payload };
  const state = sectionState(sectionRef, row);
  const approved = Boolean(payload.review.approved_sections?.value?.[key]);
  const isOutput = section.source === "we_build";
  // Nothing to approve in a section that is still empty.
  const anyFilled = (section.fields ?? []).some((f) => formatFieldValue(payload, f).length > 0);
  const canApprove = state === "ready" && (isOutput || anyFilled);

  return (
    <section id={`s-${key.replace(":", "-")}`} className="bp-section scroll-mt-24">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <h3 className="min-w-0 text-[1.25rem] font-semibold leading-snug tracking-[-0.02em] text-[var(--bp-ink)]">
            {section.title}
          </h3>
          <InfoTip label={section.title}>
            <SectionAbout section={section} />
          </InfoTip>
        </div>
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
            {approved ? "Approved" : isOutput ? "Approve" : "Looks right"}
          </button>
        ) : null}
      </header>

      {section.tip ? (
        <p className="bp-tinted mb-5 flex gap-2.5 rounded-xl bg-[#eef6fd] px-4 py-3 text-[0.9375rem] leading-[1.6] text-[#0b3f6b]">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[var(--bp-sky)]" aria-hidden />
          <span>
            <span className="font-semibold">BCA recommends: </span>
            {section.tip}
          </span>
        </p>
      ) : null}

      {isOutput ? <Output refKey={key} section={section} /> : <Fields section={section} />}
    </section>
  );
}
