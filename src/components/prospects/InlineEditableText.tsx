"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type Props = {
  label?: string;
  value: string | null | undefined;
  placeholder?: string;
  saving?: boolean;
  multiline?: boolean;
  type?: "text" | "email" | "tel" | "url";
  /** Normalize before save; return null to clear. */
  normalize?: (raw: string) => string | null;
  /** Validate before save; return error message or null. */
  validate?: (raw: string) => string | null;
  onSave: (next: string | null) => void | Promise<void>;
  display?: (value: string) => ReactNode;
  className?: string;
  valueClassName?: string;
};

export function InlineEditableText({
  label,
  value,
  placeholder = "—",
  saving = false,
  multiline = false,
  type = "text",
  normalize,
  validate,
  onSave,
  display,
  className = "",
  valueClassName = "",
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const skipBlurSave = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(value ?? "");
  }, [value, editing]);

  useEffect(() => {
    if (!editing) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [editing]);

  async function commit() {
    setError(null);
    const raw = draft;
    const validationError = validate?.(raw) ?? null;
    if (validationError) {
      setError(validationError);
      inputRef.current?.focus();
      return;
    }
    const next = normalize ? normalize(raw) : raw.trim() || null;
    const prev = (value ?? "").trim() || null;
    if (next === prev) {
      setEditing(false);
      return;
    }
    try {
      await onSave(next);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save.");
      inputRef.current?.focus();
    }
  }

  function cancel() {
    skipBlurSave.current = true;
    setDraft(value ?? "");
    setError(null);
    setEditing(false);
  }

  const shown = (value ?? "").trim();

  return (
    <div className={className}>
      {label ? (
        <div className="text-[11px] text-slate-400">{label}</div>
      ) : null}
      {editing ? (
        <div className={label ? "mt-0.5" : undefined}>
          {multiline ? (
            <textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={draft}
              disabled={saving}
              rows={2}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => {
                if (skipBlurSave.current) {
                  skipBlurSave.current = false;
                  return;
                }
                void commit();
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  cancel();
                }
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  void commit();
                }
              }}
              className="w-full resize-y rounded-md border border-sky-300 bg-white px-2 py-1 text-sm text-slate-900 outline-none ring-2 ring-sky-100"
            />
          ) : (
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type={type}
              value={draft}
              disabled={saving}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => {
                if (skipBlurSave.current) {
                  skipBlurSave.current = false;
                  return;
                }
                void commit();
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  cancel();
                }
                if (e.key === "Enter") {
                  e.preventDefault();
                  void commit();
                }
              }}
              className="w-full rounded-md border border-sky-300 bg-white px-2 py-1 text-sm text-slate-900 outline-none ring-2 ring-sky-100"
            />
          )}
          {error ? (
            <p className="mt-1 text-[11px] text-rose-600">{error}</p>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setError(null);
            setDraft(value ?? "");
            setEditing(true);
          }}
          disabled={saving}
          title="Click to edit"
          className={`group w-full rounded-md text-left transition hover:bg-slate-50 ${
            label ? "mt-0.5" : ""
          } -mx-1 px-1 py-0.5 ${valueClassName}`}
        >
          {shown ? (
            <span className="break-all text-sm text-slate-800 group-hover:text-slate-950">
              {display ? display(shown) : shown}
            </span>
          ) : (
            <span className="text-sm text-slate-400 group-hover:text-slate-500">
              {placeholder}
            </span>
          )}
        </button>
      )}
    </div>
  );
}
