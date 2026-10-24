"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

import { type Block, type Tone, inToneOrder } from "@/lib/salesCall/blocks";
import { followScript, pageForPart, type ScriptPage } from "@/lib/callSimulator/script";
import type { Prospect } from "@/lib/callSimulator/prospects";
import type { SimCallType, TranscriptLine } from "@/lib/callSimulator/types";

import { fillText, type Slots } from "@/components/salesCall/slots";

/** The Scripts' type scale (ScriptSheet's BODY, SECTION and part title), so the call reads like the script page. */
const BODY = "text-[1.0625rem] leading-[1.45] tracking-[-0.006em]";
const SECTION = "text-[1.3125rem] font-normal leading-tight tracking-[-0.012em]";
const TITLE = "text-[1.625rem] font-normal leading-tight tracking-[-0.015em]";

const DOT: Record<Tone, string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-400",
  blue: "bg-sky-500",
  orange: "bg-orange-500",
  red: "bg-rose-500",
};

/**
 * glass: the script across the middle of the call, cream on the navy room, in
 * the Scripts' type and spacing (Zander, 23 Oct). paper: the first version, a
 * white page beside the face, kept at ?script=side.
 */
export type ScriptLook = "glass" | "paper";

const LOOK = {
  glass: {
    wrap: "mx-auto w-full max-w-[44rem] px-1 pb-10 pt-2 text-[var(--sim-cream)]",
    top: "text-[var(--sim-cream-faint)]",
    live: "text-[var(--sim-good)]",
    liveDot: "bg-[var(--sim-good)]",
    title: `${TITLE} text-[var(--sim-cream)]`,
    titleQuiet: `${TITLE} text-[var(--sim-cream-soft)]`,
    goal: `mt-1 ${BODY} text-[var(--sim-cream-soft)]`,
    rule: "border-[var(--sim-cream-line)]",
    section: `${SECTION} text-[var(--sim-cream-soft)]`,
    say: "text-[var(--sim-cream)]",
    sayDone: "text-[var(--sim-cream)]/40",
    sayNow: "bg-[rgba(143,227,184,0.12)] text-[var(--sim-cream)] ring-1 ring-[rgba(143,227,184,0.45)] shadow-[0_0_40px_rgba(143,227,184,0.12)]",
    sayNowLabel: "text-[var(--sim-good)]",
    check: "text-[var(--sim-good)]",
    they: "text-[var(--sim-cream-soft)]",
    note: "text-[var(--sim-cream-soft)]",
    list: "text-[var(--sim-cream-soft)] marker:text-[var(--sim-cream-faint)]",
    message: "border border-[var(--sim-cream-line)] bg-[var(--sim-glass)]",
    messageText: "text-[var(--sim-cream)]",
    answer: "bg-[var(--sim-glass)] hover:bg-[var(--sim-glass-strong)]",
    answerOpen: "bg-[var(--sim-glass-strong)]",
    answerText: "text-[var(--sim-cream)]",
    chevron: "text-[var(--sim-cream-faint)]",
  },
  paper: {
    wrap: "rounded-3xl bg-white p-5 text-slate-900 shadow-2xl sm:p-6",
    top: "text-slate-400",
    live: "text-emerald-700",
    liveDot: "bg-emerald-500",
    title: "text-[1.0625rem] font-medium tracking-[-0.01em] text-slate-900",
    titleQuiet: "text-[1.0625rem] font-medium tracking-[-0.01em] text-slate-600",
    goal: "hidden",
    rule: "border-slate-100",
    section: "text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-slate-400",
    say: "text-slate-900",
    sayDone: "text-slate-900/45",
    sayNow: "bg-emerald-50 text-emerald-950 ring-1 ring-emerald-300",
    sayNowLabel: "text-emerald-700",
    check: "text-emerald-500",
    they: "text-slate-500",
    note: "text-slate-500",
    list: "text-slate-600 marker:text-slate-300",
    message: "border border-slate-200",
    messageText: "text-slate-700",
    answer: "bg-slate-50 hover:bg-slate-100",
    answerOpen: "bg-slate-100",
    answerText: "text-slate-800",
    chevron: "text-slate-400",
  },
} as const;

/** Plain words for matching: fill-ins swapped for the owner's own. */
function plain(text: string, slots: Slots): string {
  return text.replace(/\{([a-z_]+)\}/g, (_, k: string) => (k in slots ? slots[k as keyof Slots] : ""));
}

/**
 * The script on the call, in the same words, type and spacing as Get
 * Clients → Scripts. It follows the coach: lines they've said get a tick,
 * the next one glows green and scrolls into view, and an answer opens once
 * they say a line from it. Starts at the part they're practising.
 */
export function CallScript({
  call,
  prospect,
  pages,
  lines,
  stage,
  price,
  me,
  look = "glass",
}: {
  call: SimCallType;
  prospect: Prospect;
  pages: ScriptPage[];
  lines: TranscriptLine[];
  stage: string;
  price: string;
  me: string;
  look?: ScriptLook;
}) {
  const L = LOOK[look];
  const slots: Slots = {
    name: prospect.firstName,
    business: prospect.business,
    result: prospect.profile.goal.label.toLowerCase(),
    problem: prospect.profile.problem.label.toLowerCase(),
    pain: prospect.profile.cost.label,
    number: "",
    why: prospect.profile.personal.label.toLowerCase(),
    price,
    guarantee: "",
    me,
  };
  // The owner's name and business fill their gaps; anything else stays a gap to say in your own words.
  const gaps = { values: { name: prospect.firstName, business: prospect.business, company: prospect.business }, set: () => {} };
  const fill = (t: string): ReactNode => fillText(t, slots, () => {}, undefined, gaps);

  const coachKey = lines
    .filter((l) => l.role === "coach")
    .map((l) => l.text)
    .join("\n");
  const stagePage = pages.findIndex((p) => p.id === pageForPart(call, stage));
  const { all, said, openBranches, next } = useMemo(
    () => followScript(pages, coachKey ? coachKey.split("\n") : [], stagePage, (t) => plain(t, slots)),
    // slots only change with the owner, who is fixed for the call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pages, coachKey, stagePage]
  );
  const nextPage = all.find((l) => l.key === next)?.page ?? -1;

  const [toggled, setToggled] = useState<Set<string>>(new Set());
  const flip = (id: string) =>
    setToggled((prev) => {
      const out = new Set(prev);
      if (out.has(id)) out.delete(id);
      else out.add(id);
      return out;
    });

  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!next) return;
    const el = box.current?.querySelector(`[data-line="${next}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [next]);

  function render(blocks: Block[], path: string): ReactNode {
    const out: ReactNode[] = [];
    let answers: { b: Extract<Block, { type: "response" }>; key: string }[] = [];
    let prevType: Block["type"] | null = null;
    // The Scripts' rhythm: a note tucks under the line above it, and a new thing after lines or answers gets room.
    const gap = (type: Block["type"]) =>
      out.length === 0
        ? ""
        : type === "note" && prevType === "say"
          ? "mt-1"
          : prevType === "response"
            ? "mt-7"
            : prevType === "say" && type !== "say"
              ? "mt-6"
              : "mt-3.5";
    const flush = () => {
      if (!answers.length) return;
      out.push(
        <div key={`a${out.length}`} className={`space-y-1.5 ${gap("response")}`}>
          {inToneOrder(answers.map((a) => ({ ...a, tone: a.b.tone }))).map(({ b, key }) => {
            const open = openBranches.has(key) !== toggled.has(key);
            return (
              <div key={key} className={`rounded-xl transition ${open ? L.answerOpen : L.answer}`}>
                <button type="button" onClick={() => flip(key)} aria-expanded={open} className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left ${BODY} ${L.answerText}`}>
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[b.tone]}`} aria-hidden />
                  <span className="min-w-0 flex-1">{fill(b.label)}</span>
                  <ChevronDown className={`h-4 w-4 shrink-0 transition ${L.chevron} ${open ? "rotate-180" : ""}`} aria-hidden />
                </button>
                {open ? <div className="px-3.5 pb-3.5">{render(b.blocks, key)}</div> : null}
              </div>
            );
          })}
        </div>
      );
      answers = [];
      prevType = "response";
    };
    blocks.forEach((b, i) => {
      const key = `${path}.${i}`;
      if (b.type === "response") {
        answers.push({ b, key });
        return;
      }
      flush();
      const space = gap(b.type);
      switch (b.type) {
        case "heading":
          out.push(
            <h3 key={key} className={`${L.section} ${out.length ? `mt-8 border-t pt-8 ${L.rule}` : ""}`}>
              {b.text}
            </h3>
          );
          prevType = null;
          return;
        case "say": {
          const done = said.has(key);
          const now = key === next;
          out.push(
            <p
              key={key}
              data-line={key}
              className={`relative whitespace-pre-line font-semibold transition ${BODY} ${space} ${
                now ? `-mx-3.5 rounded-2xl px-3.5 py-3 ${L.sayNow}` : done ? `pl-6 ${L.sayDone}` : L.say
              }`}
            >
              {now ? <span className={`mb-1 block text-[0.6875rem] font-semibold uppercase tracking-[0.14em] ${L.sayNowLabel}`}>Say next</span> : null}
              {done && !now ? <Check className={`absolute left-0 top-1 h-4 w-4 ${L.check}`} aria-label="Said" /> : null}
              {fill(b.text)}
            </p>
          );
          break;
        }
        case "they":
          out.push(
            <p key={key} className={`italic ${BODY} ${space} ${L.they}`}>
              {fill(b.text)}
            </p>
          );
          break;
        case "note":
          out.push(
            <p key={key} className={`${BODY} ${space} ${L.note}`}>
              {fill(b.text)}
            </p>
          );
          break;
        case "list":
        case "points":
          out.push(
            <ul key={key} className={`list-disc space-y-1.5 pl-5 ${BODY} ${space} ${L.list}`}>
              {b.items.map((item) => (
                <li key={item}>{fill(item.replace(/^\d+\. /, ""))}</li>
              ))}
            </ul>
          );
          break;
        case "message":
          out.push(
            <div key={key} className={`rounded-xl px-4 py-3 ${space} ${L.message}`}>
              <p className={`text-[0.6875rem] font-semibold uppercase tracking-[0.14em] ${L.top}`}>{b.label}</p>
              <p className={`mt-1 whitespace-pre-line ${BODY} ${L.messageText}`}>{fill(b.text)}</p>
            </div>
          );
          break;
        default:
          return;
      }
      prevType = b.type;
    });
    flush();
    return out;
  }

  return (
    <div ref={box} className={L.wrap}>
      <p className={`flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] ${L.top}`}>
        Script · {call.title}
        <span className={`ml-auto inline-flex items-center gap-1.5 normal-case tracking-normal ${L.live}`}>
          <span className={`h-1.5 w-1.5 animate-pulse rounded-full ${L.liveDot}`} aria-hidden /> Following you
        </span>
      </p>
      <div className="mt-5 space-y-10">
        {pages.map((p, i) => {
          const open = (p.folded ? i === nextPage || all.some((l) => l.page === i && said.has(l.key)) : true) !== toggled.has(`page${i}`);
          return (
            <section key={p.id}>
              <button type="button" onClick={() => flip(`page${i}`)} aria-expanded={open} className="flex w-full items-start gap-3 text-left">
                <span className="min-w-0 flex-1">
                  <span className={`block ${i === nextPage || !p.folded ? L.title : L.titleQuiet}`}>{p.title}</span>
                  {p.goal && open ? <span className={`block ${L.goal}`}>{p.goal}</span> : null}
                </span>
                <ChevronDown className={`mt-1.5 h-5 w-5 shrink-0 transition ${L.chevron} ${open ? "rotate-180" : ""}`} aria-hidden />
              </button>
              {open ? <div className={look === "glass" ? `mt-6 border-t pt-7 ${L.rule}` : "mt-3"}>{render(p.blocks, `${i}`)}</div> : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
