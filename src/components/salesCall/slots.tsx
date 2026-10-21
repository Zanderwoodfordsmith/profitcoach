"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

import { TECHNIQUES, type TechniqueId } from "@/lib/salesCall/techniques";

/**
 * The fill-ins in the call script: the owner's name, business and the five
 * facts, taken from the call details. Filled ones are blue on a blue
 * highlight so the coach reads straight through; empty ones are grey boxes
 * showing what's needed. Clicking one edits it right there, in a small box
 * under the words, so the coach never loses their place in the script.
 */

export type SlotKey = "name" | "business" | "result" | "problem" | "pain" | "number" | "why" | "price" | "guarantee";

export type Slots = Record<SlotKey, string>;

/** Slots the coach can edit on the page. Price and guarantee come from the Blueprint. */
export const EDITABLE: SlotKey[] = ["name", "business", "result", "problem", "pain", "number", "why"];

const EMPTY: Record<SlotKey, string> = {
  name: "their name",
  business: "their business",
  result: "the result they want",
  problem: "their problem",
  pain: "what it's costing them",
  number: "their numbers",
  why: "why it matters to them",
  price: "your investment",
  guarantee: "your guarantee: add it on Your Offer in your Blueprint",
};

/** Filled from the call details: blue words on a blue highlight. */
const FILLED = "bg-[#d6ecfb] text-[#0b5394]";
/** Still to fill on the day: upright darker grey on grey, so it reads as a gap. */
const TO_FILL = "bg-slate-100 font-medium text-slate-700";
const CHIP = "rounded-md px-1.5 py-0.5 [box-decoration-break:clone]";

/** Skill names like "confidence loop": a plain link that opens the explainer. */
const TERM_LINK =
  "font-medium text-[#0b5394] underline decoration-sky-300 decoration-1 underline-offset-[3px] hover:decoration-[#0b5394]";
const TERMS = new RegExp(`(${TECHNIQUES.map((t) => t.match.source).join("|")})`, "gi");

function linkTerms(text: string, onTerm: ((id: TechniqueId) => void) | undefined, key: number): ReactNode {
  if (!onTerm) return text;
  return text.split(TERMS).map((part, i) => {
    const technique = i % 2 === 1 ? TECHNIQUES.find((t) => t.match.test(part)) : null;
    if (!technique) return part;
    return (
      <button key={`${key}-${i}`} type="button" onClick={() => onTerm(technique.id)} className={TERM_LINK}>
        {part}
      </button>
    );
  });
}

const PRICE_LINE = "So {name}, to get you to {result}, working together is {price}.";

/** Mid-sentence, so "Working 3 days a week" reads "working 3 days a week" (but "MD" stays "MD"). */
function midSentence(value: string): string {
  return /^[A-Z][a-z]/.test(value) ? value[0].toLowerCase() + value.slice(1) : value;
}

function Slot({ slot, value, raw, onEdit }: { slot: SlotKey; value: string; raw: string; onEdit: (key: SlotKey, value: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(raw);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // preventScroll: the page must stay exactly where the coach is reading.
    if (editing) input.current?.focus({ preventScroll: true });
  }, [editing]);

  const open = () => {
    setDraft(raw);
    setEditing(true);
  };
  const save = () => {
    setEditing(false);
    if (draft.trim() !== raw.trim()) onEdit(slot, draft.trim());
  };

  return (
    <span className="relative">
      <span
        role="button"
        tabIndex={0}
        title="Click to change"
        onClick={open}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            open();
          }
        }}
        className={`${CHIP} cursor-pointer ${value ? `${FILLED} hover:bg-sky-200` : `${TO_FILL} hover:bg-slate-200`}`}
      >
        {value || EMPTY[slot]}
      </span>
      {editing ? (
        <span className="absolute left-0 top-full z-30 mt-1.5 block w-[min(26rem,80vw)] rounded-lg bg-white p-2 shadow-[0_12px_30px_-10px_rgba(15,23,42,0.35)] ring-1 ring-slate-200">
          <input
            ref={input}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setEditing(false);
            }}
            placeholder={EMPTY[slot]}
            aria-label={`Change ${EMPTY[slot]}`}
            className="w-full rounded-md bg-slate-50 px-2.5 py-1.5 text-sm font-normal text-slate-900 outline-none focus:bg-white focus:ring-1 focus:ring-sky-300"
          />
          <span className="mt-1 block px-1 text-xs font-normal text-slate-500">Enter to save, Esc to cancel</span>
        </span>
      ) : null}
    </span>
  );
}

export function fillText(
  text: string,
  slots: Slots,
  onEdit: (key: SlotKey, value: string) => void,
  onTerm?: (id: TechniqueId) => void,
): ReactNode {
  const parts = text.replaceAll("{price_line}", PRICE_LINE).split(/(\{[a-z_]+\}|\[[^\]]+\])/g);
  return parts.map((part, i) => {
    const token = /^\{([a-z_]+)\}$/.exec(part);
    if (token && token[1] in EMPTY) {
      const key = token[1] as SlotKey;
      const raw = slots[key];
      const value = key === "result" || key === "problem" || key === "pain" ? midSentence(raw) : raw;
      if (EDITABLE.includes(key)) return <Slot key={i} slot={key} value={value} raw={raw} onEdit={onEdit} />;
      return (
        <span key={i} className={`${CHIP} ${value ? FILLED : TO_FILL}`}>
          {value || EMPTY[key]}
        </span>
      );
    }
    if (/^\[[^\]]+\]$/.test(part)) {
      // Things only the coach can fill in on the day, like "[repeat their words]".
      return (
        <span key={i} className={`${CHIP} ${TO_FILL}`}>
          {part.slice(1, -1)}
        </span>
      );
    }
    return linkTerms(part, onTerm, i);
  });
}
