"use client";

import { useRef, useState } from "react";

/**
 * A ticket's name that turns into a box when clicked (23 Nov). Enter or
 * clicking away saves, Escape cancels. Saving it empty clears the name, so
 * the inbox falls back to the coach's name.
 */
export function EditableTicketTitle({
  value,
  display,
  onSave,
  className,
}: {
  /** The saved name, empty when there isn't one. */
  value: string;
  /** What to show when not editing (the name, or its fallback). */
  display: string;
  onSave: (next: string | null) => void;
  /** Text size, weight and colour, so it matches where it sits. */
  className: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  // Set once Enter, Escape or blur has closed the box, so a blur after Escape can't save.
  const closed = useRef(false);

  function finish(save: boolean) {
    if (draft === null || closed.current) return;
    closed.current = true;
    const next = draft.trim();
    setDraft(null);
    if (save && next !== value.trim()) onSave(next || null);
  }

  if (draft !== null) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={() => finish(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            finish(true);
          } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            finish(false);
          }
        }}
        placeholder="Name this thread"
        aria-label="Thread name"
        className={`min-w-0 flex-1 rounded-md border border-sky-500 bg-white px-1.5 py-0.5 outline-none ${className}`}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        closed.current = false;
        setDraft(value);
      }}
      title="Click to rename"
      className={`min-w-0 flex-1 cursor-text truncate rounded-md px-1.5 py-0.5 text-left hover:bg-slate-900/5 ${className}`}
    >
      {display}
    </button>
  );
}
