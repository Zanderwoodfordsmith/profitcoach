"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Check, Copy, Loader2, Sparkles, Undo2 } from "lucide-react";
import { FIELD_LIMITS, type ProfileOptimizerVariant } from "@/lib/linkedinProfileOptimizer/types";

export type RewriteChatTurn =
  | { kind: "user"; text: string }
  | { kind: "assistant"; variants: ProfileOptimizerVariant[] };

export function RewriteCoachPanel({
  sectionLabel,
  instruction,
  onInstruction,
  onRewrite,
  rewriting,
  turns,
  onPickVariant,
  onCopy,
  copied,
  onRevert,
  canRevert,
  adminControl = null,
}: {
  sectionLabel: string | null;
  instruction: string;
  onInstruction: (next: string) => void;
  onRewrite: () => void;
  rewriting: boolean;
  turns: RewriteChatTurn[];
  onPickVariant: (variant: ProfileOptimizerVariant) => void;
  onCopy: () => void;
  copied: boolean;
  onRevert: () => void;
  canRevert: boolean;
  adminControl?: ReactNode;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const ready = Boolean(sectionLabel);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [turns, rewriting]);

  function submit() {
    if (!ready || rewriting) return;
    onRewrite();
  }

  return (
    <aside className="flex max-h-[min(36rem,70vh)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:sticky lg:top-[4.5rem] lg:max-h-[calc(100vh-7rem)] lg:w-[340px] lg:shrink-0">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
            Rewrite
          </p>
          <p className="truncate text-sm font-semibold text-slate-900">
            {sectionLabel ?? "Pick a section"}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          {adminControl}
          <button
            type="button"
            onClick={onCopy}
            disabled={!ready}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            onClick={onRevert}
            disabled={!ready || !canRevert}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            <Undo2 className="h-3.5 w-3.5" />
            Live
          </button>
        </div>
      </div>

      <div ref={scroller} className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
        {!ready ? (
          <p className="text-sm leading-relaxed text-slate-500">
            Click Headline, About, Featured, Experience, or Banner. Then tell
            the rewrite what to change.
          </p>
        ) : turns.length === 0 ? (
          <p className="text-sm leading-relaxed text-slate-500">
            Rewrite uses their brain and this section. Add a note if you want it
            shorter, more proof, or aimed at a specific owner.
          </p>
        ) : (
          turns.map((turn, i) =>
            turn.kind === "user" ? (
              <div key={`u-${i}`} className="ml-6 rounded-2xl rounded-br-md bg-sky-600 px-3 py-2 text-sm leading-snug text-white">
                {turn.text}
              </div>
            ) : (
              <div
                key={`a-${i}`}
                className="mr-4 rounded-2xl rounded-bl-md border border-slate-200 bg-slate-50 px-3 py-2"
              >
                <p className="text-xs font-medium text-slate-500">
                  Applied the recommended line. Try another:
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {turn.variants.map((variant, vi) => (
                    <button
                      key={`${variant.label}-${vi}`}
                      type="button"
                      onClick={() => onPickVariant(variant)}
                      className="rounded-full border border-sky-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-sky-800 hover:bg-sky-50"
                    >
                      {variant.recommended ? "★ " : ""}
                      {variant.label}
                    </button>
                  ))}
                </div>
              </div>
            )
          )
        )}
        {rewriting ? (
          <div className="mr-4 inline-flex items-center gap-2 rounded-2xl rounded-bl-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Rewriting…
          </div>
        ) : null}
      </div>

      <div className="border-t border-slate-100 p-3">
        <textarea
          value={instruction}
          maxLength={FIELD_LIMITS.instruction}
          disabled={!ready || rewriting}
          onChange={(e) => onInstruction(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={3}
          placeholder={
            ready
              ? "e.g. more manufacturing, shorter, add a proof line"
              : "Select a section first"
          }
          className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 disabled:bg-slate-50"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!ready || rewriting}
          className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {rewriting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Rewrite {sectionLabel ?? "section"}
        </button>
      </div>
    </aside>
  );
}
