"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, ChevronRight, Eraser, LayoutList, Lightbulb } from "lucide-react";

import "../practice/document/blueprint.css";
import { buttonClass } from "@/components/ui/Button";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import type { ScriptCard } from "@/lib/salesCall/library";
import { PHASES } from "@/lib/salesCall/script";

import { SalesCallWorkspace } from "./SalesCallWorkspace";
import { CoachingNotes, collectNotes, PageIntro, Sheet, SheetBody, splitIntro } from "./ScriptSheet";
import { type Slots, fillText } from "./slots";
import { useGaps } from "./useGaps";

/** Nothing to fill from a call here: only the price (Blueprint) and the coach's first name come in. */
const NO_SLOTS: Slots = { name: "", business: "", result: "", problem: "", pain: "", number: "", why: "", price: "", guarantee: "", me: "" };

/**
 * One script: its overview by default, a part once ?part= names one. The
 * Profit Roadmap call opens the live call screen at its step instead.
 */
export function ScriptView({ script }: { script: ScriptCard }) {
  const asked = useSearchParams().get("part");
  if (!script.parts && asked && PHASES.some((p) => p.id === asked)) return <SalesCallWorkspace />;
  return <ScriptLibraryPage script={script} asked={asked} />;
}

/**
 * The overview and the parts of one script from Get Clients → Scripts: its
 * parts down a tinted rail, the part on white, and the why behind a Coaching
 * notes button, the same way the call screen reads.
 */
function ScriptLibraryPage({ script, asked }: { script: ScriptCard; asked: string | null }) {
  // The Profit Roadmap call has no static parts: its overview lists the call's steps.
  const outline = script.parts ?? PHASES.map((p) => ({ id: p.id, title: p.title, goal: p.goal, blocks: [] }));
  const part = script.parts?.find((p) => p.id === asked) ?? null;
  const prefix = usePathname()?.startsWith("/admin") ? "/admin" : "/coach";
  const router = useRouter();
  const [coachingOpen, setCoachingOpen] = useState(false);
  const [price, setPrice] = useState("");
  const [me, setMe] = useState("");
  const { impersonatingCoachId } = useImpersonation();
  const gaps = useGaps();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const h = await getCoachAuthHeaders(impersonatingCoachId);
        if (!h) return;
        const ctx = await fetch("/api/coach/sales-call/context", { headers: h }).then((r) => r.json());
        if (cancelled) return;
        if (typeof ctx?.price === "string") setPrice(ctx.price);
        if (typeof ctx?.name === "string") setMe(ctx.name.trim().split(/\s+/)[0] ?? "");
      } catch {
        // The script reads fine without them; they show as gaps.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [impersonatingCoachId]);

  const fill = (text: string) => fillText(text, { ...NO_SLOTS, price, me }, () => {}, undefined, gaps);
  const base = `${prefix}/script/${script.id}`;
  const goPart = (id: string | null) => {
    if (script.parts) router.replace(id ? `${base}?part=${id}` : base);
    else router.push(id ? `${base}?part=${id}` : base);
  };
  // A short note that opens the page sits at the top; only the rest go behind the button.
  const { intro, rest } = splitIntro(part?.blocks ?? []);
  const notes = collectNotes(rest);

  const railItem = (active: boolean) =>
    `flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
      active ? "bg-[#06223d] text-white" : "text-slate-700 hover:bg-white/80"
    }`;
  const railBadge = (active: boolean) =>
    `flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
      active ? "bg-white/15 text-white" : "bg-white text-slate-500 ring-1 ring-slate-200"
    }`;

  return (
    <div className="-mx-4 -mb-6 flex min-h-[calc(100dvh-57px)] flex-col md:-mx-[60px] lg:flex-row lg:items-stretch">
      <nav
        aria-label={`${script.title} parts`}
        className="min-w-0 shrink-0 border-b border-slate-200 bg-[#f3f6fa] px-3 py-3 lg:sticky lg:top-[57px] lg:h-[calc(100dvh-57px)] lg:w-64 lg:self-start lg:overflow-y-auto lg:border-b-0 lg:border-r lg:py-5"
      >
        <Link href={`${prefix}/script`} className="mb-3 inline-flex items-center gap-1.5 px-3 text-sm font-medium text-slate-500 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          All scripts
        </Link>
        <p className="mb-2 hidden px-3 text-sm font-semibold text-slate-900 lg:block">{script.title}</p>
        <ol className="flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
          <li className="shrink-0">
            <button type="button" aria-current={!part ? "page" : undefined} onClick={() => goPart(null)} className={railItem(!part)}>
              <span className={railBadge(!part)}>
                <LayoutList className="h-3.5 w-3.5" aria-hidden />
              </span>
              <span className="flex-1 whitespace-nowrap font-medium">Overview</span>
            </button>
          </li>
          {outline.map((p, i) => {
            const active = p.id === part?.id;
            return (
              <li key={p.id} className="shrink-0">
                <button type="button" aria-current={active ? "step" : undefined} onClick={() => goPart(p.id)} className={railItem(active)}>
                  <span className={railBadge(active)}>{i + 1}</span>
                  <span className="flex-1 whitespace-nowrap font-medium lg:whitespace-normal">{p.title}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {part ? (
        <section aria-labelledby="part-title" className="min-w-0 flex-1 space-y-6 bg-white px-6 py-8 md:px-10 lg:px-14">
          <header className="flex items-start justify-between gap-4 border-b border-slate-200 pb-6">
            <div>
              <h2 id="part-title" className="text-title font-normal leading-tight text-slate-900">
                {part.title}
              </h2>
              <p className="mt-1 text-read leading-[1.45] text-slate-600">{part.goal}</p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {gaps.filled ? (
              <button
                type="button"
                onClick={gaps.clearAll}
                title="Clear everything you've typed into the gaps, ready for the next person"
                className={buttonClass("quiet", "normal", "shrink-0")}
              >
                <Eraser className="h-4 w-4" aria-hidden />
                Clear details
              </button>
            ) : null}
            {notes.length ? (
              <button
                type="button"
                onClick={() => setCoachingOpen(true)}
                className={buttonClass("second", "normal", "shrink-0")}
              >
                <Lightbulb className="h-4 w-4" aria-hidden />
                Tips
              </button>
            ) : null}
            </div>
          </header>
          <Sheet key={part.id}>
            <PageIntro notes={intro} fill={fill} />
            <SheetBody blocks={rest} fill={fill} open={() => {}} tight={part.tight} />
          </Sheet>
        </section>
      ) : (
        <ScriptOverview script={script} outline={outline} onOpen={goPart} />
      )}

      {part ? <CoachingNotes open={coachingOpen} onClose={() => setCoachingOpen(false)} title={part.title} notes={notes} fill={fill} /> : null}
    </div>
  );
}

/** Where you land: the Blueprint's blue cover, then the parts as a contents list. */
function ScriptOverview({
  script,
  outline,
  onOpen,
}: {
  script: ScriptCard;
  outline: { id: string; title: string; goal: string }[];
  onOpen: (id: string) => void;
}) {
  return (
    <section aria-labelledby="script-title" className="bp-doc min-w-0 flex-1">
      <header className="bp-cover px-6 pb-10 pt-9 text-white md:px-12 md:pb-11 md:pt-11">
        <div className="flex flex-col gap-8 xl:flex-row xl:items-center xl:justify-between xl:gap-10">
          <div className="min-w-0">
            <p className="text-ui font-semibold uppercase tracking-[0.32em] text-white/80">{script.eyebrow}</p>
            <h1 id="script-title" className="bp-display mt-4 text-[2.5rem] font-medium leading-[1.02] tracking-[-0.035em] md:text-[3.25rem]">
              {script.title}
            </h1>
            <p className="mt-5 max-w-[46ch] text-read leading-[1.55] text-white/80">{script.summary}</p>
            <button
              type="button"
              onClick={() => onOpen(outline[0].id)}
              className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-ui font-semibold text-[#0c5290] shadow-sm transition hover:bg-sky-50"
            >
              {script.parts ? "Start with part 1" : "Start the call"}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={script.cover}
            alt=""
            className="aspect-video w-full max-w-[26rem] shrink-0 rounded-2xl object-cover shadow-[0_24px_50px_-20px_rgba(2,12,27,0.7)] ring-1 ring-white/25"
          />
        </div>
      </header>

      <div className="bp-home-field px-6 py-10 md:px-12">
        <div className="bp-home-group max-w-[52rem]">
          <h2 className="bp-display text-title font-medium text-[var(--bp-navy)]">{script.parts ? "What's in it" : "The call, step by step"}</h2>
          <ol className="mt-5 space-y-3">
            {outline.map((p, i) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onOpen(p.id)}
                  className="bp-glass-card group flex w-full items-start gap-4 rounded-2xl px-5 py-4 text-left hover:-translate-y-px"
                >
                  <span className="relative z-[2] mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-sm font-semibold text-[#0c5290] ring-1 ring-sky-100">
                    {i + 1}
                  </span>
                  <span className="relative z-[2] min-w-0 flex-1">
                    <span className="block text-lg font-semibold tracking-tight text-slate-900">{p.title}</span>
                    <span className="mt-0.5 block text-base leading-relaxed text-slate-600">{p.goal}</span>
                  </span>
                  <ChevronRight className="relative z-[2] mt-2 h-5 w-5 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-[#0c5290]" aria-hidden />
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
