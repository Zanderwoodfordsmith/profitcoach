"use client";

import { type ReactNode, useEffect, useState } from "react";
import { ArrowRight, ChevronDown, Info, MousePointerClick, Play, X } from "lucide-react";

import { type Block, type Tone, inToneOrder } from "@/lib/salesCall/blocks";
import { OBJECTION_PAGES, type ObjectionId, pageById } from "@/lib/salesCall/objections";
import type { Technique } from "@/lib/salesCall/techniques";
import { Modal } from "@/components/ui/Modal";

/**
 * Every step and objection page, laid out like the ClickUp call script: lines to say in bold,
 * their replies in italics, quiet ⓘ toggles for the why, and a toggle for
 * each way the owner might answer. The colour is a dot and a faint tint,
 * nothing more, so the words carry the page. The list of objections lives in
 * the call's left rail.
 */

/**
 * One type scale for the whole script. Lines to say, notes, replies and
 * answer choices share one size. Only the lines you say are bold; headings
 * are larger but medium weight. SMALL is only for the hint above a set of
 * answers and the examples under an answer.
 */
const BODY = "text-[1.0625rem] leading-[1.45] tracking-[-0.006em]";
const SMALL = "text-sm leading-[1.5]";
/** A step softer than the bold lines to say, still clearly darker than the timing line under it. */
export const SECTION = "text-[1.3125rem] font-normal leading-tight tracking-[-0.012em] text-slate-700";

/** The script's one column, about 88 characters a line at 17px bold (40rem felt narrow, 46rem too wide). The pitch uses it too. */
export const SCRIPT_COLUMN = "max-w-[42rem]";
const TEXT_ONLY = SCRIPT_COLUMN;

/** tint: the answer box. panel: the reply under it, the same colour so the two read as one. */
const TONE: Record<Tone, { tint: string; panel: string; dot: string }> = {
  red: { tint: "bg-rose-50 hover:bg-rose-100/60", panel: "bg-rose-50", dot: "bg-rose-500" },
  orange: { tint: "bg-orange-50 hover:bg-orange-100/60", panel: "bg-orange-50", dot: "bg-orange-500" },
  yellow: { tint: "bg-amber-50 hover:bg-amber-100/60", panel: "bg-amber-50", dot: "bg-amber-400" },
  green: { tint: "bg-emerald-50 hover:bg-emerald-100/60", panel: "bg-emerald-50", dot: "bg-emerald-500" },
  blue: { tint: "bg-sky-50 hover:bg-sky-100/60", panel: "bg-sky-50", dot: "bg-sky-500" },
};

type Segment =
  /** why: a note that explains one of their replies, shown behind an ⓘ beside it. */
  | { kind: "one"; block: Block; why?: string }
  | { kind: "answers"; blocks: Extract<Block, { type: "response" }>[] }
  | { kind: "links"; blocks: Extract<Block, { type: "goto" }>[] };

/** Answer options and links that follow each other form one tight group. */
function segments(blocks: Block[]): Segment[] {
  const out: Segment[] = [];
  for (const b of blocks) {
    const last = out[out.length - 1];
    // Coaching notes live in the page's Coaching notes panel, not in the script.
    if (b.type === "info") continue;
    // A note after one of their replies explains it, so it hides behind an ⓘ on the reply.
    if (b.type === "note" && last?.kind === "one" && last.block.type === "they" && !last.why) {
      last.why = b.text;
      continue;
    }
    if (b.type === "response") {
      if (last?.kind === "answers") last.blocks.push(b);
      else out.push({ kind: "answers", blocks: [b] });
    } else if (b.type === "goto") {
      if (last?.kind === "links") last.blocks.push(b);
      else out.push({ kind: "links", blocks: [b] });
    } else out.push({ kind: "one", block: b });
  }
  for (const seg of out) if (seg.kind === "answers") seg.blocks = inToneOrder(seg.blocks);
  return out;
}

/** Top-level headings start sections; everything before the first heading is the page's intro. */
function sections(blocks: Block[]): { heading: string | null; blocks: Block[] }[] {
  const out: { heading: string | null; blocks: Block[] }[] = [{ heading: null, blocks: [] }];
  for (const b of blocks) {
    if (b.type === "heading") out.push({ heading: b.text, blocks: [] });
    else out[out.length - 1].blocks.push(b);
  }
  return out.filter((s) => s.heading || s.blocks.some((b) => b.type !== "info"));
}

type Ctx = { fill: (t: string) => ReactNode; open: (id: ObjectionId) => void };

function One({ block, ctx }: { block: Block; ctx: Ctx }) {
  const { fill } = ctx;
  switch (block.type) {
    case "say":
      return <p className={`whitespace-pre-line font-semibold text-slate-900 ${BODY}`}>{fill(block.text)}</p>;
    case "they":
      return <p className={`italic text-slate-600 ${BODY}`}>{fill(block.text)}</p>;
    case "note":
      return <p className={`text-slate-600 ${BODY}`}>{fill(block.text)}</p>;
    case "points":
      return (
        <ul className={`list-disc space-y-1.5 pl-5 font-semibold text-slate-900 marker:text-slate-300 ${BODY}`}>
          {block.items.map((item) => (
            <li key={item}>{fill(item)}</li>
          ))}
        </ul>
      );
    case "video":
      return <Video block={block} />;
    default:
      return null;
  }
}

/** An ⓘ that shows why on hover, or on tap where there's no hover. Tapping again or moving away hides it. */
function Why({ text, fill }: { text: string; fill: Ctx["fill"] }) {
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  return (
    <span className="relative ml-1.5 inline-block align-[-0.15em] not-italic">
      <button
        type="button"
        aria-label="Why"
        aria-expanded={hover || pinned}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={() => setPinned((p) => !p)}
        onBlur={() => setPinned(false)}
        className="rounded-full text-slate-400 hover:text-[#0c5290] focus-visible:text-[#0c5290]"
      >
        <Info className="h-4 w-4" aria-hidden />
      </button>
      {hover || pinned ? (
        <span
          role="tooltip"
          className={`absolute left-0 top-full z-20 mt-2 w-[min(19rem,80vw)] overflow-hidden rounded-lg border-t-[3px] border-[#0c5290] bg-white px-4 py-3 text-slate-700 shadow-[0_12px_32px_-12px_rgba(15,23,42,0.28),0_0_0_1px_rgba(15,23,42,0.06)] ${SMALL}`}
        >
          {fill(text)}
        </span>
      ) : null}
    </span>
  );
}

/** A thumbnail until it's clicked, so nothing loads or plays on its own mid-call. */
function Video({ block }: { block: Extract<Block, { type: "video" }> }) {
  const [playing, setPlaying] = useState(false);
  const frame = block.upright ? "aspect-[9/16] w-full max-w-[18rem]" : "aspect-video w-full";
  if (playing) {
    return (
      <div className={`${frame} overflow-hidden rounded-lg bg-black`}>
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${block.youtubeId}?autoplay=1&rel=0`}
          title={block.title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          className="h-full w-full"
        />
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      className="group flex w-full items-center gap-4 rounded-lg bg-slate-50 p-2.5 pr-4 text-left hover:bg-slate-100"
    >
      <span className="relative h-20 w-14 shrink-0 overflow-hidden rounded-md bg-slate-200">
        {/* eslint-disable-next-line @next/next/no-img-element -- a YouTube thumbnail, not a local asset */}
        <img src={`https://i.ytimg.com/vi/${block.youtubeId}/hqdefault.jpg`} alt="" className="h-full w-full object-cover" />
        <span className="absolute inset-0 flex items-center justify-center bg-black/20">
          <Play className="h-5 w-5 fill-white text-white" aria-hidden />
        </span>
      </span>
      <span className={`text-slate-900 group-hover:text-[#0c5290] ${BODY}`}>{block.title}</span>
    </button>
  );
}

/** "Shallow response (e.g. it worked for others)" → the answer, and its example on a smaller line. */
function splitExample(label: string): { main: string; example: string | null } {
  const m = /^(.*?)\s*\((e\.g\.[^)]*)\)\s*$/.exec(label);
  return m ? { main: m[1], example: m[2] } : { main: label, example: null };
}

const COLS: Record<number, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
};

/**
 * An answer as a toggle: a chevron on the right, and the reply opens
 * straight underneath in the same colour, so the two read as one box.
 * `dim` fades it while another toggle in its list is open.
 */
function Toggle({
  block,
  ctx,
  open,
  onToggle,
  dim = false,
}: {
  block: Extract<Block, { type: "response" }>;
  ctx: Ctx;
  open: boolean;
  onToggle: () => void;
  dim?: boolean;
}) {
  const tone = TONE[block.tone];
  const { main, example } = splitExample(block.label);
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className={`flex w-full items-start gap-2 px-3 py-2.5 text-left transition ${
          open ? `rounded-t-md ${tone.panel}` : `rounded-md ${tone.tint}`
        } ${dim ? "opacity-45 hover:opacity-80" : ""}`}
      >
        <span aria-hidden className={`mt-[0.4rem] h-2.5 w-2.5 shrink-0 rounded-full ${tone.dot}`} />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[1.0625rem] leading-[1.3] tracking-[-0.01em] text-slate-900">{ctx.fill(main)}</span>
          {example ? <span className={`text-slate-600 ${SMALL}`}>{ctx.fill(example)}</span> : null}
        </span>
        <ChevronDown
          aria-hidden
          className={`mt-0.5 h-5 w-5 shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <div className={`rounded-b-md pb-4 pl-[1.875rem] pr-5 pt-1 ${tone.panel}`}>
          <Blocks blocks={block.blocks} ctx={ctx} />
        </div>
      ) : null}
    </div>
  );
}

/** Above four, a row of boxes wraps and the reply lands far from the box you clicked, so they stack instead. */
const MOST_IN_A_ROW = 4;

/**
 * Two or more answers: a quiet "Click the best match" hint, then the
 * choices. Up to four sit in a row of equal boxes with the reply flush
 * under them; more stack one per row, each opening in place. Either way,
 * picking one fades the others and picking it again clears it. On a call
 * you only ever take one path.
 */
function Answers({ blocks, ctx }: { blocks: Extract<Block, { type: "response" }>[]; ctx: Ctx }) {
  const [picked, setPicked] = useState<number | null>(null);
  const pick = (i: number) => setPicked((cur) => (cur === i ? null : i));
  if (blocks.length === 1) return <Toggle block={blocks[0]} ctx={ctx} open={picked === 0} onToggle={() => pick(0)} />;
  const chosen = picked === null ? null : blocks[picked];
  const hint = (
    <p className={`mb-1.5 flex items-center gap-1.5 pt-3 text-slate-400 ${SMALL}`}>
      <MousePointerClick aria-hidden className="h-3.5 w-3.5 shrink-0" />
      Click the best match
    </p>
  );
  if (blocks.length > MOST_IN_A_ROW) {
    return (
      <div>
        {hint}
        <div className="space-y-1.5">
          {blocks.map((b, i) => (
            <Toggle key={i} block={b} ctx={ctx} open={picked === i} onToggle={() => pick(i)} dim={picked !== null && picked !== i} />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div>
      {hint}
      <div className="overflow-hidden rounded-md">
        <div className={`grid grid-cols-2 gap-0.5 ${COLS[blocks.length]}`} role="tablist" aria-label="What did they say?">
          {blocks.map((b, i) => {
            const tone = TONE[b.tone];
            const active = i === picked;
            const { main, example } = splitExample(b.label);
            return (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => pick(i)}
                className={`flex h-full flex-col items-start gap-1 px-3 py-2.5 text-left transition ${tone.tint} ${
                  chosen && !active ? "opacity-45 hover:opacity-80" : ""
                }`}
              >
                <span className="flex items-start gap-2">
                  <span aria-hidden className={`mt-[0.4rem] h-2.5 w-2.5 shrink-0 rounded-full ${tone.dot}`} />
                  <span className="text-[1.0625rem] leading-[1.3] tracking-[-0.01em] text-slate-900">{ctx.fill(main)}</span>
                </span>
                {example ? <span className={`pl-[1.125rem] text-slate-600 ${SMALL}`}>{ctx.fill(example)}</span> : null}
              </button>
            );
          })}
        </div>
        {chosen ? (
          <div role="tabpanel" className={`px-5 py-4 ${TONE[chosen.tone].panel}`}>
            <Blocks blocks={chosen.blocks} ctx={ctx} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

const GROUP_LABEL = {
  objection: "They name an objection? Open its page.",
  close: "No objection, or not sure? Start Loop 0.",
  next: "Once it's decided",
} as const;

function Links({ blocks, ctx }: { blocks: Extract<Block, { type: "goto" }>[]; ctx: Ctx }) {
  const link = (b: Extract<Block, { type: "goto" }>, i: number) => (
    <button
      key={i}
      type="button"
      onClick={() => ctx.open(b.to)}
      className={`inline-flex items-center gap-1.5 text-left text-[#0c5290] hover:underline ${BODY}`}
    >
      {b.text || pageById(b.to)?.title}
      <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
    </button>
  );
  // A long list that mixes objections and closes splits into a labelled column for each.
  const groups = [...new Set(blocks.map((b) => pageById(b.to)?.group ?? "objection"))];
  if (groups.length > 1 && blocks.length > 2) {
    return (
      <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {groups.map((g) => (
          <div key={g}>
            <p className={`mb-1.5 font-medium text-slate-500 ${SMALL}`}>{GROUP_LABEL[g]}</p>
            <div className="flex flex-col items-start gap-1.5">
              {blocks.filter((b) => (pageById(b.to)?.group ?? "objection") === g).map(link)}
            </div>
          </div>
        ))}
      </div>
    );
  }
  return <div className="flex flex-wrap gap-x-5 gap-y-1.5">{blocks.map(link)}</div>;
}

function Blocks({ blocks, ctx }: { blocks: Block[]; ctx: Ctx }) {
  const list = segments(blocks);
  return (
    <div className="space-y-3.5">
      {list.map((seg, i) => {
        const prev = list[i - 1];
        // A note belongs to the line just above it ("Wait for the yes."), so it sits tight under it.
        const tucked = seg.kind === "one" && seg.block.type === "note" && prev?.kind === "one" && prev.block.type === "say";
        // Whatever follows a set of answers starts something new, so it gets more room.
        const afterAnswers = prev?.kind === "answers";
        // Lines to say read as one block, with room after the last one (and its tucked note).
        const isSay = (s?: Segment) => s?.kind === "one" && s.block.type === "say";
        const prevTucked = prev?.kind === "one" && prev.block.type === "note" && isSay(list[i - 2]);
        // "Click the best match" already brings its own room above a set of answers.
        const hinted = seg.kind === "answers" && seg.blocks.length > 1;
        const afterScript = (isSay(prev) || prevTucked) && !isSay(seg) && !tucked && !hinted;
        return (
          <div
            key={i}
            className={`min-w-0 ${TEXT_ONLY} ${tucked ? "!mt-1" : afterAnswers ? "!mt-7" : afterScript ? "!mt-6" : ""}`}
          >
            {seg.kind === "answers" ? (
              <Answers blocks={seg.blocks} ctx={ctx} />
            ) : seg.kind === "links" ? (
              <Links blocks={seg.blocks} ctx={ctx} />
            ) : (
              seg.why && seg.block.type === "they" ? (
                <p className={`italic text-slate-600 ${BODY}`}>
                  {ctx.fill(seg.block.text)}
                  <Why text={seg.why} fill={ctx.fill} />
                </p>
              ) : (
                <One block={seg.block} ctx={ctx} />
              )
            )}
          </div>
        );
      })}
    </div>
  );
}

export type CoachingNote = { section: string | null; near: string | null; title: string; body: string[] };

/** Plain words for "next to …": placeholders become "…", brackets drop away. */
function excerpt(text: string): string {
  const plain = text.replace(/\{[a-z_]+\}/g, "…").replace(/\[([^\]]+)\]/g, "$1");
  return plain.length > 80 ? `${plain.slice(0, 78).trimEnd()}…` : plain;
}

/** Every coaching note on a page, with the section and the line it goes with. */
export function collectNotes(blocks: Block[]): CoachingNote[] {
  const out: CoachingNote[] = [];
  const walk = (list: Block[], section: string | null, within: string | null) => {
    let lastSay: string | null = null;
    for (const b of list) {
      if (b.type === "heading") {
        section = b.text;
        lastSay = null;
      } else if (b.type === "say") lastSay = b.text;
      else if (b.type === "info") {
        out.push({ section, near: lastSay ? `Next to: “${excerpt(lastSay)}”` : within, title: b.title, body: b.body });
      } else if (b.type === "response") walk(b.blocks, section, `When they say: ${b.label}`);
    }
  };
  walk(blocks, null, null);
  return out;
}

/** The page's coaching notes, in a panel from the right that leaves the script where it is. */
export function CoachingNotes({
  open,
  onClose,
  title,
  notes,
  fill,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  notes: CoachingNote[];
  fill: (t: string) => ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  const groups: { section: string | null; notes: CoachingNote[] }[] = [];
  for (const n of notes) {
    const last = groups[groups.length - 1];
    if (last && last.section === n.section) last.notes.push(n);
    else groups.push({ section: n.section, notes: [n] });
  }
  return (
    <>
      <div aria-hidden onClick={onClose} className="fixed inset-x-0 bottom-0 top-[57px] z-40 bg-slate-900/10" />
      <aside
        role="dialog"
        aria-label="Coaching notes"
        className="fixed bottom-0 right-0 top-[57px] z-50 flex w-[min(28rem,100vw)] flex-col border-l border-slate-200 bg-white shadow-[-12px_0_30px_-18px_rgba(15,23,42,0.35)]"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-5">
          <div>
            <p className={`text-slate-500 ${SMALL}`}>Coaching notes</p>
            <h2 className="mt-0.5 text-lg font-semibold tracking-tight text-slate-900">{title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close coaching notes" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>
        <div className="flex-1 space-y-7 overflow-y-auto px-6 py-6">
          {groups.map((g, i) => (
            <section key={i} className="space-y-4">
              {g.section ? <h3 className={`font-semibold uppercase tracking-[0.06em] text-[#0c5290] ${SMALL}`}>{g.section}</h3> : null}
              {g.notes.map((n, j) => (
                <div key={j}>
                  <p className="font-semibold text-slate-900">{n.title}</p>
                  {n.near ? <p className={`mt-0.5 italic text-slate-500 ${SMALL}`}>{n.near}</p> : null}
                  <div className={`mt-2 space-y-2 text-slate-700 ${SMALL}`}>
                    {n.body.map((para) => (
                      <p key={para}>{fill(para)}</p>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          ))}
        </div>
      </aside>
    </>
  );
}

/** Sections split by headings, divided by faint rules: the body of every step and objection page. */
export function SheetBody({ blocks, fill, open }: Ctx & { blocks: Block[] }) {
  return (
    <div>
      {sections(blocks).map((section, i) => {
        // A note or a reply straight under a heading describes the section, so it sits in the header.
        const first = section.blocks[0];
        const lead = section.heading && (first?.type === "note" || first?.type === "they") ? first : null;
        return (
          <section key={i} className="py-8 first:pt-0 last:pb-0">
            {i > 0 ? <div aria-hidden className={`-mt-8 mb-8 h-px bg-slate-100 ${TEXT_ONLY}`} /> : null}
            {section.heading ? (
              <header className={`mb-4 ${TEXT_ONLY}`}>
                <h3 className={SECTION}>{section.heading}</h3>
                {lead ? (
                  <p className={`mt-1 text-slate-500 ${lead.type === "they" ? "italic" : ""} ${BODY}`}>{fill(lead.text)}</p>
                ) : null}
              </header>
            ) : null}
            <Blocks blocks={lead ? section.blocks.slice(1) : section.blocks} ctx={{ fill, open }} />
          </section>
        );
      })}
    </div>
  );
}

/** One white sheet, the way every step of the call reads. */
export function Sheet({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <div className={SCRIPT_COLUMN}>
      <article id={id} className="scroll-mt-24">
        {children}
      </article>
    </div>
  );
}

export function ObjectionPages({
  current,
  onOpen,
  fill,
}: {
  current: ObjectionId;
  onOpen: (id: ObjectionId) => void;
  fill: (text: string) => ReactNode;
}) {
  const page = pageById(current) ?? OBJECTION_PAGES[0];
  const open = (id: ObjectionId) => {
    onOpen(id);
    document.getElementById("objection-page")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <Sheet id="objection-page" key={page.id}>
      {/* What they say (or when to use it) opens the page, above the script and its notes. */}
      {page.trigger ? (
        <p className={`mb-6 text-slate-600 ${BODY} ${TEXT_ONLY} ${page.trigger.startsWith('"') ? "italic" : ""}`}>
          {page.trigger.startsWith('"') ? page.trigger : `Use it: ${page.trigger}`}
        </p>
      ) : null}
      <SheetBody blocks={page.blocks} fill={fill} open={open} />
    </Sheet>
  );
}

/** The explainer behind a skill the script names, like confidence looping, over the call. */
export function TechniqueModal({ technique, onClose, fill, open }: Ctx & { technique: Technique | null; onClose: () => void }) {
  return (
    <Modal
      open={Boolean(technique)}
      onClose={onClose}
      title={technique?.name ?? ""}
      titleId="technique-title"
      subtitle={technique?.summary}
      maxWidthClassName="max-w-[44rem]"
      overlayClassName="z-[80]"
      glass
    >
      {technique ? (
        <div className="max-h-[68vh] overflow-y-auto px-10 pb-9 pt-6">
          {technique.video ? (
            <video src={technique.video.src} poster={technique.video.poster} controls className="mb-8 aspect-video w-full rounded-lg bg-slate-900" />
          ) : null}
          <SheetBody blocks={technique.blocks} fill={fill} open={open} />
        </div>
      ) : null}
    </Modal>
  );
}
