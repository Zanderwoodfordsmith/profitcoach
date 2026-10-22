"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ElementType } from "react";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Paragraphs from a blank line, line breaks from a single newline. */
export function Paragraphs({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/\n\s*\n/)
        .map((para) => para.trim())
        .filter(Boolean)
        .map((para, i) => (
          <p key={i}>
            {para.split("\n").map((line, j, all) => (
              <span key={j}>
                {line}
                {j < all.length - 1 ? <br /> : null}
              </span>
            ))}
          </p>
        ))}
    </>
  );
}

type Props = {
  value: string;
  editing: boolean;
  onCommit: (next: string) => void;
  label: string;
  placeholder: string;
  multiline?: boolean;
  maxLength?: number;
  className?: string;
  /** The element drawn on the live page. */
  as?: ElementType;
  /** Multi-paragraph text on the live page. */
  paragraphs?: boolean;
};

/**
 * Text that reads the same in both modes: on the live page it is the element
 * itself, while editing it is a textarea in the same type that grows with its
 * text. Saves when the field loses focus; Escape puts the old text back.
 */
export function Editable({
  value,
  editing,
  onCommit,
  label,
  placeholder,
  multiline = false,
  maxLength,
  className,
  as: Tag = "p",
  paragraphs = false,
}: Props) {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);

  // A newer saved value replaces the draft.
  if (value !== seen) {
    setSeen(value);
    setDraft(value);
  }

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft, editing]);

  if (!editing) {
    if (!value.trim()) return null;
    return paragraphs ? (
      <div className={className}>
        <Paragraphs text={value} />
      </div>
    ) : (
      <Tag className={className}>{value}</Tag>
    );
  }

  return (
    <textarea
      ref={ref}
      className={`dp-edit ${className ?? ""}`}
      aria-label={label}
      placeholder={placeholder}
      value={draft}
      rows={1}
      maxLength={maxLength}
      onChange={(e) => setDraft(multiline ? e.target.value : e.target.value.replace(/\n/g, " "))}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setDraft(value);
          e.currentTarget.blur();
        }
        if (!multiline && e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      onBlur={() => {
        const next = draft.trim();
        if (next !== value.trim()) onCommit(next);
      }}
    />
  );
}
