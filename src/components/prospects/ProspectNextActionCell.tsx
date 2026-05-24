"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatDueDateLabel } from "@/lib/actionPlans/actionOutlineUtils";
import type { ProspectNextAction } from "@/lib/actionPlans/prospectFollowUp";

type Props = {
  nextAction: ProspectNextAction | null | undefined;
  editable?: boolean;
  saving?: boolean;
  onSave: (values: { text: string; due_at: string | null } | null) => void | Promise<void>;
};

export function ProspectNextActionCell({
  nextAction,
  editable = false,
  saving = false,
  onSave,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [textDraft, setTextDraft] = useState(nextAction?.text ?? "");
  const [dueDraft, setDueDraft] = useState(nextAction?.dueAt ?? "");
  const textRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!editing) {
      setTextDraft(nextAction?.text ?? "");
      setDueDraft(nextAction?.dueAt ?? "");
    }
  }, [nextAction, editing]);

  useEffect(() => {
    if (editing) textRef.current?.focus();
  }, [editing]);

  async function commit() {
    setEditing(false);
    const text = textDraft.trim();
    const due_at = dueDraft.trim() || null;
    if (!text && !nextAction?.text) return;
    if (
      text === (nextAction?.text ?? "") &&
      due_at === (nextAction?.dueAt ?? null)
    ) {
      return;
    }
    await onSave(text ? { text, due_at } : null);
  }

  if (editing) {
    return (
      <div
        className="flex min-w-[11rem] flex-col gap-1"
        data-row-action
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={textRef}
          type="text"
          value={textDraft}
          onChange={(e) => setTextDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void commit();
            if (e.key === "Escape") setEditing(false);
          }}
          placeholder="Next action"
          className="rounded border border-sky-300 bg-white px-2 py-1 text-sm text-slate-700 outline-none focus:ring-1 focus:ring-sky-500"
        />
        <input
          type="date"
          value={dueDraft}
          onChange={(e) => setDueDraft(e.target.value)}
          onBlur={() => void commit()}
          className="rounded border border-sky-300 bg-white px-2 py-1 text-sm text-slate-700 outline-none focus:ring-1 focus:ring-sky-500"
        />
      </div>
    );
  }

  if (!nextAction?.text) {
    if (!editable) return <span className="text-slate-400">—</span>;
    return (
      <button
        type="button"
        data-row-action
        onClick={(e) => {
          e.stopPropagation();
          setEditing(true);
        }}
        className="text-left text-sm text-slate-400 hover:text-sky-700"
      >
        {saving ? "Saving…" : "Add next action"}
      </button>
    );
  }

  const dueLabel = nextAction.dueAt
    ? formatDueDateLabel(`${nextAction.dueAt}T09:00`)
    : null;

  const content = (
    <div className="flex min-w-[10rem] flex-col gap-0.5">
      <span className="text-sm font-medium text-slate-800">{nextAction.text}</span>
      {dueLabel ? (
        <span className="text-xs text-slate-500">{dueLabel}</span>
      ) : null}
    </div>
  );

  if (!editable) return content;

  return (
    <div className="flex items-start gap-2" data-row-action>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setEditing(true);
        }}
        className="text-left hover:text-sky-700"
        title="Edit next action"
      >
        {content}
      </button>
      <Link
        href="/coach/signature/actions"
        onClick={(e) => e.stopPropagation()}
        className="shrink-0 text-[10px] font-medium text-sky-600 hover:text-sky-800"
        title="View in My Actions"
      >
        Actions
      </Link>
    </div>
  );
}
