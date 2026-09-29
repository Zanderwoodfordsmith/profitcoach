"use client";

import { useState } from "react";
import { AlertTriangle, Check, Copy, Info, Lightbulb, Pencil } from "lucide-react";

import type { BlueprintBlock } from "@/lib/practiceKnowledge/types";

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        });
      }}
      className="bp-no-print inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-[var(--bp-blue)] transition-colors hover:bg-[var(--bp-tint-strong)]"
    >
      {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
      {copied ? "Copied" : label}
    </button>
  );
}

function MessageBlock({
  block,
  onSave,
}: {
  block: Extract<BlueprintBlock, { type: "message" }>;
  onSave?: (body: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(block.body);
  const [saving, setSaving] = useState(false);
  const chars = editing ? draft.length : block.body.length;
  return (
    <figure className="bp-keep overflow-hidden rounded-2xl border border-[var(--bp-rule)] bg-white shadow-[0_10px_30px_-22px_rgba(5,30,54,0.45)]">
      <figcaption className="flex items-center justify-between gap-3 border-b border-[var(--bp-rule)] bg-[var(--bp-tint)] px-4 py-2">
        <span className="min-w-0 truncate text-[0.8125rem] font-semibold text-[var(--bp-ink)]">
          {block.label || "Message"}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="bp-num text-xs text-[var(--bp-faint)]">{chars} characters</span>
          {onSave && !editing ? (
            <button
              type="button"
              onClick={() => {
                setDraft(block.body);
                setEditing(true);
              }}
              className="bp-no-print inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-[var(--bp-muted)] transition-colors hover:bg-[var(--bp-tint-strong)] hover:text-[var(--bp-blue)]"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              Edit
            </button>
          ) : null}
          <CopyButton text={editing ? draft : block.body} />
        </span>
      </figcaption>
      {editing ? (
        <div className="px-4 py-3.5">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={Math.min(18, Math.max(4, draft.split("\n").length + 1))}
            className="block w-full resize-y rounded-lg border border-[var(--bp-rule)] px-3 py-2 text-[0.9375rem] leading-[1.65] text-[var(--bp-body)] outline-none focus:border-[var(--bp-sky)] focus:ring-2 focus:ring-[#cfe6f8]"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={saving || !draft.trim()}
              onClick={async () => {
                setSaving(true);
                const ok = await onSave!(draft.trim());
                setSaving(false);
                if (ok) setEditing(false);
              }}
              className="rounded-full bg-[var(--bp-navy)] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--bp-blue)] disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-[var(--bp-muted)] hover:bg-[var(--bp-tint)]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-wrap px-4 py-3.5 text-[0.9375rem] leading-[1.65] text-[var(--bp-body)]">
          {block.body}
        </p>
      )}
      {block.note ? (
        <p className="border-t border-dashed border-[var(--bp-rule)] px-4 py-2 text-xs leading-5 text-[var(--bp-muted)]">
          {block.note}
        </p>
      ) : null}
    </figure>
  );
}

const CALLOUT = {
  tip: { icon: Lightbulb, className: "bg-[#eef6fd] text-[#0b3f6b]", iconClass: "text-[var(--bp-sky)]" },
  warning: { icon: AlertTriangle, className: "bg-[#fff6e8] text-[#6b3d06]", iconClass: "text-[#c77a0e]" },
  note: { icon: Info, className: "bg-[#f3f5f8] text-[#2c3b4e]", iconClass: "text-[#5b6b80]" },
} as const;

function Timeline({ block }: { block: Extract<BlueprintBlock, { type: "timeline" }> }) {
  const n = block.items.length;
  return (
    <div className="bp-keep">
      {/* Wide screens and print: a planning chart with a bar per phase. */}
      <div className="hidden @2xl:block">
        <div
          className="grid gap-x-4"
          style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
        >
          {block.items.map((item, i) => (
            <div key={`${item.when}-${i}`} className="min-w-0">
              <p className="bp-num text-xs font-semibold uppercase tracking-[0.06em] text-[var(--bp-blue)]">
                {item.when}
              </p>
              <div className="relative mt-2 h-2 rounded-full bg-[var(--bp-tint-strong)]">
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${Math.round(((i + 1) / n) * 100)}%`,
                    background: "linear-gradient(90deg, #0c5290, #1a8fd4)",
                  }}
                />
              </div>
              <p className="mt-3 text-[0.9375rem] font-semibold leading-snug text-[var(--bp-ink)]">{item.title}</p>
              {item.detail ? <p className="mt-1 text-sm leading-6 text-[var(--bp-muted)]">{item.detail}</p> : null}
            </div>
          ))}
        </div>
      </div>
      {/* Phones: a vertical run. */}
      <ol className="space-y-4 @2xl:hidden">
        {block.items.map((item, i) => (
          <li key={`${item.when}-${i}`} className="grid grid-cols-[5.5rem_1fr] gap-3">
            <span className="bp-num pt-0.5 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--bp-blue)]">
              {item.when}
            </span>
            <span>
              <span className="block text-[0.9375rem] font-semibold text-[var(--bp-ink)]">{item.title}</span>
              {item.detail ? <span className="mt-0.5 block text-sm leading-6 text-[var(--bp-muted)]">{item.detail}</span> : null}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function Blocks({
  blocks,
  onSaveMessage,
}: {
  blocks: BlueprintBlock[];
  /** When set, message blocks get an Edit button that saves through this. */
  onSaveMessage?: (index: number, body: string) => Promise<boolean>;
}) {
  return (
    <div className="space-y-5">
      {blocks.map((block, i) => {
        const key = `${block.type}-${i}`;
        switch (block.type) {
          case "lede":
            return (
              <p key={key} className="bp-display text-[1.3125rem] leading-[1.5] text-[var(--bp-ink)] @2xl:text-[1.4375rem]">
                {block.text}
              </p>
            );
          case "paragraph":
            return (
              <p key={key} className="max-w-[68ch] whitespace-pre-line text-[1.0078rem] leading-[1.7]">
                {block.text}
              </p>
            );
          case "heading":
            return (
              <h4 key={key} className="!mt-9 text-[1.0625rem] font-semibold tracking-[-0.01em] text-[var(--bp-ink)]">
                {block.text}
              </h4>
            );
          case "bullets":
            return (
              <ul key={key} className="max-w-[68ch] space-y-2.5">
                {block.items.map((item, j) => (
                  <li key={j} className="grid grid-cols-[0.875rem_1fr] gap-2.5 text-[1.0078rem] leading-[1.65]">
                    <span aria-hidden className="mt-[0.62em] h-1.5 w-1.5 rounded-[1px] bg-[var(--bp-sky)]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            );
          case "numbered":
            return (
              <ol key={key} className="max-w-[68ch] space-y-2.5">
                {block.items.map((item, j) => (
                  <li key={j} className="grid grid-cols-[1.75rem_1fr] gap-2 text-[1.0078rem] leading-[1.65]">
                    <span className="bp-num pt-px text-sm font-semibold text-[var(--bp-blue)]">{j + 1}.</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            );
          case "quote":
            return (
              <blockquote key={key} className="bp-keep relative py-2 pl-9 @2xl:pl-11">
                <svg
                  aria-hidden
                  viewBox="0 0 32 24"
                  className="absolute left-0 top-2 h-5 w-7 text-[var(--bp-sky)] @2xl:h-6 @2xl:w-8"
                  fill="currentColor"
                >
                  <path d="M0 24V14.2C0 6.4 4.3 1.6 12.2 0l1.4 3C9 4.6 7 7.4 6.8 11.2H13V24H0Zm19 0V14.2C19 6.4 23.3 1.6 31.2 0l1.4 3C28 4.6 26 7.4 25.8 11.2H32V24H19Z" />
                </svg>
                <p className="bp-display whitespace-pre-line text-[1.25rem] italic leading-[1.55] text-[var(--bp-ink)]">
                  {block.text}
                </p>
                {block.cite ? (
                  <footer className="mt-2 text-sm font-medium text-[var(--bp-muted)]">{block.cite}</footer>
                ) : null}
              </blockquote>
            );
          case "stats":
            return (
              <dl
                key={key}
                className="bp-keep bp-tinted grid grid-cols-2 overflow-hidden rounded-2xl bg-[var(--bp-tint)] @2xl:grid-cols-[repeat(var(--n),minmax(0,1fr))]"
                style={{ ["--n" as string]: String(block.items.length) }}
              >
                {block.items.map((item, j) => (
                  <div
                    key={j}
                    className="border-[var(--bp-rule)] px-5 py-5 @2xl:[&:not(:first-child)]:border-l"
                  >
                    <dt className="sr-only">{item.label}</dt>
                    <dd className="bp-display bp-num text-[2rem] font-medium leading-none text-[var(--bp-navy)] @2xl:text-[2.375rem]">
                      {item.value}
                    </dd>
                    <dd className="mt-2 text-[0.8125rem] leading-5 text-[var(--bp-muted)]">{item.label}</dd>
                  </div>
                ))}
              </dl>
            );
          case "pairs":
            return (
              <dl key={key} className="bp-keep grid gap-x-8 gap-y-3 @xl:grid-cols-[minmax(8rem,12rem)_1fr]">
                {block.items.map((item, j) => (
                  <div key={j} className="contents">
                    <dt className="pt-0.5 text-[0.8125rem] font-semibold text-[var(--bp-muted)]">{item.label}</dt>
                    <dd className="text-[1.0078rem] leading-[1.6] text-[var(--bp-ink)]">{item.value}</dd>
                  </div>
                ))}
              </dl>
            );
          case "table":
            return (
              <div key={key} className="bp-keep bp-scroll -mx-1 overflow-x-auto px-1">
                <table className="bp-table w-full min-w-[34rem] border-separate border-spacing-0 overflow-hidden rounded-xl border border-[var(--bp-rule)] text-left text-[0.875rem]">
                  <thead>
                    <tr>
                      {block.columns.map((col) => (
                        <th key={col} className="px-3.5 py-2.5 text-[0.75rem] font-semibold uppercase tracking-[0.05em]">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, r) => (
                      <tr key={r} className="align-top">
                        {row.map((cell, c) => (
                          <td
                            key={c}
                            className={`bp-num px-3.5 py-3 leading-[1.55] ${c === 0 ? "font-semibold text-[var(--bp-ink)]" : "text-[var(--bp-body)]"}`}
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "message":
            return (
              <MessageBlock
                key={`${key}-${block.body.length}`}
                block={block}
                onSave={onSaveMessage ? (body) => onSaveMessage(i, body) : undefined}
              />
            );
          case "callout": {
            const tone = CALLOUT[block.tone];
            const Icon = tone.icon;
            return (
              <aside key={key} className={`bp-keep bp-tinted flex gap-3 rounded-xl px-4 py-3.5 ${tone.className}`}>
                <Icon className={`mt-0.5 h-[1.125rem] w-[1.125rem] shrink-0 ${tone.iconClass}`} aria-hidden />
                <div className="text-[0.9375rem] leading-[1.6]">
                  {block.title ? <p className="font-semibold">{block.title}</p> : null}
                  <p className="whitespace-pre-line">{block.text}</p>
                </div>
              </aside>
            );
          }
          case "steps":
            return (
              <ol key={key} className="bp-keep relative space-y-5">
                {block.items.map((item, j) => (
                  <li key={j} className="relative grid grid-cols-[2rem_1fr] gap-3.5">
                    {j < block.items.length - 1 ? (
                      <span aria-hidden className="absolute left-[0.9375rem] top-8 bottom-[-1.25rem] w-px bg-[var(--bp-rule)]" />
                    ) : null}
                    <span className="bp-num relative flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bp-navy)] text-[0.8125rem] font-semibold text-white">
                      {j + 1}
                    </span>
                    <span className="pt-1">
                      <span className="block font-semibold leading-snug text-[var(--bp-ink)]">{item.title}</span>
                      {item.detail ? (
                        <span className="mt-1 block max-w-[64ch] whitespace-pre-line text-[0.9375rem] leading-[1.65] text-[var(--bp-muted)]">
                          {item.detail}
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ol>
            );
          case "timeline":
            return <Timeline key={key} block={block} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
