"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

import { AREA_ICON_SET } from "@/components/profitSystem/profitSystemData";
import { fieldClass } from "@/components/ui/Field";
import { TECHNIQUES, type TechniqueId } from "@/lib/salesCall/techniques";

/**
 * The fill-ins in the call script: the owner's name, business and the five
 * facts, taken from the call details. Filled ones are blue on a blue
 * highlight so the coach reads straight through; empty ones are grey boxes
 * showing what's needed. Clicking one edits it right there, in a small box
 * under the words, so the coach never loses their place in the script.
 */

export type SlotKey = "name" | "business" | "result" | "problem" | "pain" | "number" | "why" | "price" | "guarantee" | "me";

export type Slots = Record<SlotKey, string>;

/** Slots the coach can edit on the page. Price and guarantee come from the Blueprint, "me" (the coach's first name) from their profile. */
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
  me: "your name",
};

/** Filled from the call details: blue words on a blue highlight. */
const FILLED = "bg-[#d6ecfb] text-[#0b5394]";
/** Still to fill on the day: upright darker grey on grey, so it reads as a gap. */
const TO_FILL = "bg-slate-200 font-medium text-slate-700";
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

/** Gaps that name a BOSS area offer the ten areas to pick from, or the coach's own words. */
const AREA_GAPS = new Set(["lowest area", "second lowest area", "constraint"]);
type Option = (typeof AREA_ICON_SET)[number];

/** Mid-sentence, so "Working 3 days a week" reads "working 3 days a week" (but "MD" stays "MD"). */
function midSentence(value: string): string {
  return /^[A-Z][a-z]/.test(value) ? value[0].toLowerCase() + value.slice(1) : value;
}

/**
 * A fill-in you can click: it opens a small box right under the words, so the
 * page never moves. Enter saves, Esc cancels, Clear empties it. A filled one
 * also shows a small × on hover to clear it in one click.
 */
function Editable({
  shown,
  filled,
  raw,
  placeholder,
  onSave,
  options,
}: {
  shown: string;
  filled: boolean;
  raw: string;
  placeholder: string;
  onSave: (value: string) => void;
  /** Choices listed under the box; typing still saves the coach's own words. */
  options?: Option[];
}) {
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
    if (draft.trim() !== raw.trim()) onSave(draft.trim());
  };
  const clear = () => {
    setEditing(false);
    onSave("");
  };
  const choose = (value: string) => {
    setEditing(false);
    if (value !== raw.trim()) onSave(value);
  };

  return (
    <span className="group/fill relative">
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
        data-gap={filled ? undefined : ""}
        className={`${CHIP} cursor-pointer ${filled ? `${FILLED} hover:bg-sky-200` : `${TO_FILL} hover:bg-slate-300`}`}
      >
        {shown}
      </span>
      {filled && !editing ? (
        <button
          type="button"
          onClick={clear}
          aria-label={`Clear ${placeholder}`}
          title="Clear"
          className="absolute -right-1.5 -top-2 hidden h-4 w-4 items-center justify-center rounded-full bg-white text-caption leading-none text-slate-500 shadow ring-1 ring-slate-200 hover:text-slate-900 group-hover/fill:flex"
        >
          ×
        </button>
      ) : null}
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
            placeholder={options ? "Type your own, or pick one below" : placeholder}
            aria-label={`Change ${placeholder}`}
            className={fieldClass("input", "small")}
          />
          <span className="mt-1 flex items-center justify-between gap-3 px-1 text-xs font-normal text-slate-500">
            Enter to save, Esc to cancel
            {raw ? (
              // onMouseDown so it runs before the input's blur saves the draft.
              <button type="button" onMouseDown={(e) => { e.preventDefault(); clear(); }} className="font-medium text-[#0c5290] hover:underline">
                Clear
              </button>
            ) : null}
          </span>
          {options ? (
            <span className="mt-2 block max-h-72 overflow-y-auto border-t border-slate-100 pt-1.5">
              {options.map((o) => {
                const Icon = o.icon;
                const on = raw.trim() === o.name;
                return (
                  // onMouseDown so the pick lands before the input's blur saves what was typed.
                  <button
                    key={o.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      choose(o.name);
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm font-normal ${on ? "bg-sky-50 text-[#0b5394]" : "text-slate-800 hover:bg-slate-50"}`}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${o.color}1f`, color: o.color }}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    {o.name}
                  </button>
                );
              })}
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}

/** Words to fill in a script line, typed once and kept: "[Name]" → what the coach typed for "name". */
export type Gaps = { values: Record<string, string>; set: (key: string, value: string) => void };

/** "[Name]" and "[name]" are one gap; a second "[day]" in the same line is its own ("day#2"). */
function gapKey(label: string, seen: Map<string, number>): string {
  const base = label.trim().toLowerCase();
  const n = (seen.get(base) ?? 0) + 1;
  seen.set(base, n);
  return n > 1 ? `${base}#${n}` : base;
}

export function fillText(
  text: string,
  slots: Slots,
  onEdit: (key: SlotKey, value: string) => void,
  onTerm?: (id: TechniqueId) => void,
  gaps?: Gaps,
): ReactNode {
  const parts = text.replaceAll("{price_line}", PRICE_LINE).split(/(\{[a-z_]+\}|\[[^\]]+\])/g);
  const seen = new Map<string, number>();
  return parts.map((part, i) => {
    const token = /^\{([a-z_]+)\}$/.exec(part);
    if (token && token[1] in EMPTY) {
      const key = token[1] as SlotKey;
      const raw = slots[key];
      const value = key === "result" || key === "problem" || key === "pain" ? midSentence(raw) : raw;
      if (EDITABLE.includes(key)) {
        return <Editable key={i} shown={value || EMPTY[key]} filled={Boolean(value)} raw={raw} placeholder={EMPTY[key]} onSave={(v) => onEdit(key, v)} />;
      }
      return (
        <span key={i} className={`${CHIP} ${value ? FILLED : TO_FILL}`} data-gap={value ? undefined : ""}>
          {value || EMPTY[key]}
        </span>
      );
    }
    if (/^\[[^\]]+\]$/.test(part)) {
      // Things only the coach can fill in on the day, like "[repeat their words]".
      const label = part.slice(1, -1);
      if (gaps) {
        const key = gapKey(label, seen);
        const value = gaps.values[key] ?? "";
        return (
          <Editable
            key={i}
            shown={value || label}
            filled={Boolean(value)}
            raw={value}
            placeholder={label}
            onSave={(v) => gaps.set(key, v)}
            options={AREA_GAPS.has(label.trim().toLowerCase()) ? AREA_ICON_SET : undefined}
          />
        );
      }
      return (
        <span key={i} className={`${CHIP} ${TO_FILL}`} data-gap="">
          {part.slice(1, -1)}
        </span>
      );
    }
    return linkTerms(part, onTerm, i);
  });
}
