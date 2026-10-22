"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ArrowRight, Check, ChevronDown, Copy, ExternalLink, Info, LayoutGrid, MousePointerClick, Play, Search, X } from "lucide-react";
import { AREAS, type BossPlaybook, PLAYBOOKS } from "@/lib/bossData";

import { type Block, type Tone, inToneOrder } from "@/lib/salesCall/blocks";
import { OBJECTION_PAGES, type ObjectionId, pageById } from "@/lib/salesCall/objections";
import type { Technique } from "@/lib/salesCall/techniques";
import { Modal } from "@/components/ui/Modal";
import type { PlaybookContent } from "@/lib/playbookContentTypes";

import { useGaps } from "./useGaps";

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
    // Coaching notes live in the page's Tips panel, not in the script.
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
    case "list": {
      // "1. Call straight away" items read as steps, so they get a numbered list.
      const numbered = block.items.every((item) => /^\d+\. /.test(item));
      const Tag = numbered ? "ol" : "ul";
      return (
        <Tag className={`${numbered ? "list-decimal" : "list-disc"} space-y-1.5 pl-5 text-slate-700 marker:text-slate-400 ${BODY}`}>
          {block.items.map((item) => (
            <li key={item}>{fill(numbered ? item.replace(/^\d+\. /, "") : item)}</li>
          ))}
        </Tag>
      );
    }
    case "message":
      return <Message block={block} fill={fill} />;
    case "see":
      return <See block={block} />;
    case "video":
      return <Video block={block} />;
    case "bossPro":
      return <BossProLink text={block.text} />;
    case "levers":
      return <LeversLink text={block.text} />;
    case "playbook":
      return <PlaybookHelp fill={fill} />;
    default:
      return null;
  }
}

/** A text, email or DM to send: the words in a quiet box, with Copy that keeps the [fill-ins] as they are. */
function Message({ block, fill }: { block: Extract<Block, { type: "message" }>; fill: Ctx["fill"] }) {
  const [copied, setCopied] = useState(false);
  const body = useRef<HTMLParagraphElement>(null);
  const copy = async () => {
    try {
      // Copy what's on screen, filled-in names included, with the gaps still in [brackets].
      const clone = body.current?.cloneNode(true) as HTMLElement | undefined;
      clone?.querySelectorAll("[data-gap]").forEach((el) => {
        el.textContent = `[${el.textContent}]`;
      });
      await navigator.clipboard.writeText(clone?.textContent ?? block.text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: the words are still on the page */
    }
  };
  return (
    <div className="rounded-xl bg-[#f3f6fa] px-5 py-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className={`font-medium text-slate-500 ${SMALL}`}>{block.label}</p>
        <button
          type="button"
          onClick={copy}
          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium text-[#0c5290] hover:bg-white ${SMALL}`}
        >
          {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p ref={body} className={`whitespace-pre-line text-slate-900 ${BODY}`}>{fill(block.text)}</p>
    </div>
  );
}

/** A link to another script, under /coach or /admin, whichever the coach is on. */
function See({ block }: { block: Extract<Block, { type: "see" }> }) {
  const prefix = usePathname()?.startsWith("/admin") ? "/admin" : "/coach";
  const href = `${prefix}/script/${block.script}${block.part ? `?part=${block.part}` : ""}`;
  return (
    <Link href={href} className={`inline-flex items-center gap-1.5 text-[#0c5290] hover:underline ${BODY}`}>
      {block.text}
      <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
    </Link>
  );
}

/** BOSS Pro in a new tab, on a new person with the name and business typed into the script's gaps. */
function BossProLink({ text }: { text: string }) {
  const prefix = usePathname()?.startsWith("/admin") ? "/admin" : "/coach";
  const { values } = useGaps();
  const query = new URLSearchParams();
  if (values.name) query.set("name", values.name);
  const business = values.business || values.company;
  if (business) query.set("business", business);
  const href = `${prefix}/boss-pro${query.size ? `?${query}` : ""}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-4 py-2 font-medium text-[#0c5290] hover:bg-sky-100 ${SMALL}`}
    >
      {text}
      <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
    </a>
  );
}

/** Profit levers in a new tab. Admin only until the page is released to coaches. */
function LeversLink({ text }: { text: string }) {
  const onAdmin = usePathname()?.startsWith("/admin") ?? false;
  const { values } = useGaps();
  if (!onAdmin) return null;
  const business = values.business || values.company;
  const href = `/admin/profit-levers${business ? `?${new URLSearchParams({ business })}` : ""}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-4 py-2 font-medium text-[#0c5290] hover:bg-sky-100 ${SMALL}`}
    >
      {text}
      <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
    </a>
  );
}

const PLAYBOOK_LEVELS = ["Overwhelmed", "Overworked", "Organised", "Overseer", "Owner"];
const PLAYBOOK_KEY = "scripts:playbook";

/** Their level and constraint, kept in this browser so the review opens where the coach left it. */
const pickListeners = new Set<() => void>();
let pickMemory = "{}";

function readPick(): string {
  try {
    return localStorage.getItem(PLAYBOOK_KEY) ?? pickMemory;
  } catch {
    return pickMemory;
  }
}

function writePick(next: { level: string; area: string }) {
  pickMemory = JSON.stringify(next);
  try {
    localStorage.setItem(PLAYBOOK_KEY, pickMemory);
  } catch {
    /* memory keeps it for this visit */
  }
  pickListeners.forEach((l) => l());
}

function subscribePick(listener: () => void) {
  pickListeners.add(listener);
  return () => {
    pickListeners.delete(listener);
  };
}

/** "What's the question? The rest explains it." → the question, then the explanation. */
function splitQuestion(text: string): { ask: string; why: string } {
  const at = text.indexOf("?");
  return at > 0 ? { ask: text.slice(0, at + 1), why: text.slice(at + 1).trim() } : { ask: text, why: "" };
}

/** Pick the owner's level and constraint, and the coach gets that playbook's questions and this-week wins to coach with. */
function PlaybookHelp({ fill }: { fill: Ctx["fill"] }) {
  const raw = useSyncExternalStore(subscribePick, readPick, () => "{}");
  const pick = useMemo<{ level: string; area: string }>(() => {
    try {
      return { level: "", area: "", ...JSON.parse(raw) };
    } catch {
      return { level: "", area: "" };
    }
  }, [raw]);
  const ref = pick.level && pick.area ? `${pick.level}.${pick.area}` : "";
  // What came back, and for which playbook, so a new pick shows Loading until its own answer arrives.
  const [loaded, setLoaded] = useState<{ ref: string; playbook: PlaybookContent | null }>({ ref: "", playbook: null });
  useEffect(() => {
    if (!ref) return;
    let live = true;
    fetch(`/api/playbooks/${ref}`)
      .then((res) => (res.ok ? (res.json() as Promise<PlaybookContent>) : Promise.reject()))
      .then((content) => live && setLoaded({ ref, playbook: content }))
      .catch(() => live && setLoaded({ ref, playbook: null }));
    return () => {
      live = false;
    };
  }, [ref]);
  const playbook = loaded.ref === ref ? loaded.playbook : null;
  const failed = loaded.ref === ref && !loaded.playbook;
  const choose = (next: Partial<typeof pick>) => writePick({ ...pick, ...next });
  const select = `rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 ${SMALL}`;
  const [query, setQuery] = useState("");
  const [browsing, setBrowsing] = useState(false);
  const pickPlaybook = (p: BossPlaybook) => {
    choose({ level: String(p.level), area: String(p.area) });
    setQuery("");
    setBrowsing(false);
  };
  // Search names, areas and levels, so "cash" finds Cash Flow and "overworked" finds that level's ten.
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = words.length
    ? PLAYBOOKS.filter((p) => {
        const hay = `${p.name} ${AREAS[p.area].name} ${PLAYBOOK_LEVELS[p.level - 1]}`.toLowerCase();
        return words.every((w) => hay.includes(w));
      })
        .sort((a, b) => Number(!words.every((w) => a.name.toLowerCase().includes(w))) - Number(!words.every((w) => b.name.toLowerCase().includes(w))) || a.level - b.level)
        .slice(0, 8)
    : [];
  return (
    <div className="rounded-xl bg-[#f3f6fa] px-5 py-4">
      {/* Find one fast: search, or scan all 50 the way BOSS Pro lays them out. */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1 basis-60">
          <span className="sr-only">Search playbooks</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search playbooks, e.g. cash flow"
            className={`w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-slate-900 ${SMALL}`}
          />
        </label>
        <button
          type="button"
          aria-expanded={browsing}
          onClick={() => setBrowsing((b) => !b)}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 font-medium ${SMALL} ${
            browsing ? "bg-[#0c5290] text-white" : "bg-white text-[#0c5290] ring-1 ring-slate-200 hover:ring-sky-300"
          }`}
        >
          <LayoutGrid className="h-4 w-4" aria-hidden />
          {browsing ? "Hide all playbooks" : "Browse all playbooks"}
        </button>
      </div>
      {words.length ? (
        <ul className="mb-4 overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
          {matches.length ? (
            matches.map((p) => (
              <li key={p.ref} className="border-b border-slate-100 last:border-b-0">
                <button type="button" onClick={() => pickPlaybook(p)} className="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left hover:bg-sky-50">
                  <span className={`font-semibold text-slate-900 ${SMALL}`}>{p.name}</span>
                  <span className={`text-slate-500 ${SMALL}`}>
                    {AREAS[p.area].name} · Level {p.level}, {PLAYBOOK_LEVELS[p.level - 1]}
                  </span>
                </button>
              </li>
            ))
          ) : (
            <li className={`px-3 py-2 text-slate-500 ${SMALL}`}>No playbook matches that.</li>
          )}
        </ul>
      ) : null}
      {browsing ? (
        <div className="mb-4 overflow-x-auto rounded-lg bg-white ring-1 ring-slate-200">
          <table className={`w-full min-w-[40rem] border-collapse text-left ${SMALL}`}>
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-3 py-2 font-medium">Area</th>
                {PLAYBOOK_LEVELS.map((name, i) => (
                  <th key={name} className="px-2 py-2 font-medium">
                    {i + 1}. {name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {AREAS.map((a) => (
                <tr key={a.id} className="border-b border-slate-100 last:border-b-0">
                  <th scope="row" className="px-3 py-1.5 font-medium text-slate-700">{a.name}</th>
                  {PLAYBOOK_LEVELS.map((_, i) => {
                    const p = PLAYBOOKS.find((x) => x.level === i + 1 && x.area === a.id);
                    if (!p) return <td key={i} />;
                    const on = p.ref === ref;
                    return (
                      <td key={i} className="px-1 py-1">
                        <button
                          type="button"
                          aria-pressed={on}
                          onClick={() => pickPlaybook(p)}
                          className={`w-full rounded-md px-2 py-1.5 text-left transition-colors ${
                            on ? "bg-[#0c5290] font-semibold text-white" : "bg-[#f3f6fa] text-slate-800 hover:bg-sky-100"
                          }`}
                        >
                          {p.name}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <label className={`flex flex-col gap-1 font-medium text-slate-500 ${SMALL}`}>
          Their level
          <select value={pick.level} onChange={(e) => choose({ level: e.target.value })} className={select}>
            <option value="">Pick one</option>
            {PLAYBOOK_LEVELS.map((name, i) => (
              <option key={name} value={i + 1}>
                {i + 1}. {name}
              </option>
            ))}
          </select>
        </label>
        <label className={`flex flex-col gap-1 font-medium text-slate-500 ${SMALL}`}>
          Their constraint
          <select value={pick.area} onChange={(e) => choose({ area: e.target.value })} className={select}>
            <option value="">Pick one</option>
            {AREAS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!ref ? null : failed ? (
        <p className={`mt-4 text-slate-600 ${BODY}`}>Couldn&apos;t load that playbook. Check your connection.</p>
      ) : !playbook ? (
        <p className={`mt-4 text-slate-500 ${BODY}`}>Loading the playbook…</p>
      ) : (
        <div className="mt-5 space-y-5">
          <p className={`text-slate-600 ${BODY}`}>
            Playbook:{" "}
            <a href={`/playbooks/${ref}`} target="_blank" rel="noreferrer" className="font-semibold text-[#0c5290] hover:underline">
              {playbook.name}
            </a>
          </p>
          <div>
            <p className={`mb-2 font-medium text-slate-500 ${SMALL}`}>Questions to ask</p>
            <ul className="space-y-3">
              {playbook.thingsToThinkAbout.map((item) => {
                const { ask, why } = splitQuestion(item);
                return (
                  <li key={item}>
                    <p className={`font-semibold text-slate-900 ${BODY}`}>{fill(ask)}</p>
                    {why ? <p className={`mt-1 text-slate-600 ${SMALL}`}>{why}</p> : null}
                  </li>
                );
              })}
            </ul>
          </div>
          {playbook.quickWins.length ? (
            <div>
              <p className={`mb-2 font-medium text-slate-500 ${SMALL}`}>Quick wins for this week (pick one for their action)</p>
              <ul className={`list-disc space-y-1.5 pl-5 text-slate-700 marker:text-slate-400 ${BODY}`}>
                {playbook.quickWins.map((win) => (
                  <li key={win}>{win.replace(/^This week:\s*/i, "")}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
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
  inline = false,
}: {
  block: Extract<Block, { type: "response" }>;
  ctx: Ctx;
  open: boolean;
  onToggle: () => void;
  dim?: boolean;
  /** Keep an "(e.g. …)" example on the same line, smaller, so a stacked list reads one row each. */
  inline?: boolean;
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
        {inline ? (
          <span className="min-w-0 flex-1 text-[1.0625rem] leading-[1.3] tracking-[-0.01em] text-slate-900">
            {ctx.fill(main)}
            {example ? <span className={`ml-2 text-slate-500 ${SMALL}`}>{ctx.fill(example)}</span> : null}
          </span>
        ) : (
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-[1.0625rem] leading-[1.3] tracking-[-0.01em] text-slate-900">{ctx.fill(main)}</span>
            {example ? <span className={`text-slate-600 ${SMALL}`}>{ctx.fill(example)}</span> : null}
          </span>
        )}
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
function Answers({ blocks, ctx, stack = false }: { blocks: Extract<Block, { type: "response" }>[]; ctx: Ctx; stack?: boolean }) {
  const [picked, setPicked] = useState<number | null>(null);
  const pick = (i: number) => setPicked((cur) => (cur === i ? null : i));
  if (blocks.length === 1) return <Toggle block={blocks[0]} ctx={ctx} open={picked === 0} onToggle={() => pick(0)} inline={stack} />;
  // A section that is only answers reads like an FAQ: one per row, no hint.
  if (stack) {
    return (
      <div className="space-y-1.5">
        {blocks.map((b, i) => (
          <Toggle key={i} block={b} ctx={ctx} open={picked === i} onToggle={() => pick(i)} dim={picked !== null && picked !== i} inline />
        ))}
      </div>
    );
  }
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
            <Toggle key={i} block={b} ctx={ctx} open={picked === i} onToggle={() => pick(i)} dim={picked !== null && picked !== i} inline />
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

function Blocks({ blocks, ctx, stack = false }: { blocks: Block[]; ctx: Ctx; stack?: boolean }) {
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
              <Answers blocks={seg.blocks} ctx={ctx} stack={stack} />
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
        aria-label="Tips"
        className="fixed bottom-0 right-0 top-[57px] z-50 flex w-[min(28rem,100vw)] flex-col border-l border-slate-200 bg-white shadow-[-12px_0_30px_-18px_rgba(15,23,42,0.35)]"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-5">
          <div>
            <p className={`text-slate-500 ${SMALL}`}>Tips</p>
            <h2 className="mt-0.5 text-lg font-semibold tracking-tight text-slate-900">{title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close tips" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
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

/**
 * Sections split by headings, divided by faint rules: the body of every step and objection page.
 * tight: for guidance you scan rather than read out (like the No-show rules), no rules and smaller gaps.
 */
export function SheetBody({ blocks, fill, open, tight = false }: Ctx & { blocks: Block[]; tight?: boolean }) {
  return (
    <div>
      {sections(blocks).map((section, i) => {
        // A note or a reply straight under a heading describes the section, so it sits in the header.
        const first = section.blocks[0];
        const lead = section.heading && (first?.type === "note" || first?.type === "they") ? first : null;
        const body = lead ? section.blocks.slice(1) : section.blocks;
        const shown = body.filter((b) => b.type !== "info");
        const onlyAnswers = shown.length > 1 && shown.every((b) => b.type === "response");
        return (
          <section key={i} className={tight ? "pb-9 last:pb-0" : "py-8 first:pt-0 last:pb-0"}>
            {i > 0 && !tight ? <div aria-hidden className={`-mt-8 mb-8 h-px bg-slate-100 ${TEXT_ONLY}`} /> : null}
            {section.heading ? (
              <header className={`${shown.length ? "mb-4" : ""} ${TEXT_ONLY}`}>
                <h3 className={SECTION}>{section.heading}</h3>
                {lead ? (
                  <p className={`mt-1 text-slate-500 ${lead.type === "they" ? "italic" : ""} ${BODY}`}>{fill(lead.text)}</p>
                ) : null}
              </header>
            ) : null}
            <Blocks blocks={body} ctx={{ fill, open }} stack={onlyAnswers} />
          </section>
        );
      })}
    </div>
  );
}

/** Above this, a note that opens a page goes behind the Tips button; at or below, it sits at the top. */
const SHORT_NOTE = 350;

/**
 * Splits off the short "why" notes that open a page (before its first
 * heading), so they can sit at the top instead of behind a button.
 */
export function splitIntro(blocks: Block[]): { intro: Extract<Block, { type: "info" }>[]; rest: Block[] } {
  const intro: Extract<Block, { type: "info" }>[] = [];
  const rest: Block[] = [];
  let opening = true;
  for (const b of blocks) {
    if (b.type === "heading") opening = false;
    if (opening && b.type === "info" && b.body.join(" ").length <= SHORT_NOTE) intro.push(b);
    else rest.push(b);
  }
  return { intro, rest };
}

/** Those notes at the top of the page, set like any section (heading, then grey text) so the left edge stays clean. */
export function PageIntro({ notes, fill }: { notes: Extract<Block, { type: "info" }>[]; fill: Ctx["fill"] }) {
  if (!notes.length) return null;
  return (
    <div className={`mb-9 space-y-9 ${TEXT_ONLY}`}>
      {notes.map((n) => (
        <div key={n.title}>
          <h3 className={SECTION}>{n.title}</h3>
          {n.body.map((para) => (
            <p key={para} className={`mt-1 text-slate-500 ${BODY}`}>
              {fill(para)}
            </p>
          ))}
        </div>
      ))}
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
