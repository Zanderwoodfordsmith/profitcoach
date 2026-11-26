"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Compass, X } from "lucide-react";
import { setTourExamples } from "@/lib/tour/tourExamples";
import { PAGE_TOURS, type PageTourStep } from "./pageTours";
import { SECTION_GUIDES } from "./sectionGuides";

/**
 * Area guide (sectionGuides.ts). The (i) by an area's title opens it on the
 * overview, right under the title. The arrows then walk each tab: the tab
 * opens for real, glows, and the card moves to sit under it, so the page
 * stays in view. Client Engine areas run on into each other. Mounted once in
 * the coach and admin layouts so it survives moving between pages.
 *
 * A tab with steps in PAGE_TOURS gets "Explore this tab": the card then moves
 * round the page, pointing at one part at a time. Empty pages show example
 * rows while that runs (lib/tour/tourExamples).
 */

const STORAGE_KEY = "bca.sectionTour.state";
const CHANGE_EVENT = "bca:section-tour";
const CARD_WIDTH = 352;
const EDGE = 16;
const GAP = 14;

type Step = {
  kind: "overview" | "tab";
  guideKey: string;
  hubTitle: string;
  group: string;
  headline: string;
  body: string;
  /** Tabs: how to find it on screen. */
  anchor: string;
  href: string;
  label: string;
  /** Position inside the section, overview first. */
  index: number;
  count: number;
};

/** A one-off guide with its own steps, not an area guide (the About You questions left). */
type CustomTour = { title: string; steps: PageTourStep[] };

type TourState = { step: number; sub: number | null; custom?: CustomTour } | null;

function readState(): TourState {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TourState) : null;
  } catch {
    return null;
  }
}

function writeState(state: TourState) {
  try {
    if (state == null) window.sessionStorage.removeItem(STORAGE_KEY);
    else window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage blocked: the guide still runs on this page.
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: state }));
}

function buildSteps(prefix: "/coach" | "/admin"): Step[] {
  return SECTION_GUIDES.flatMap((guide) => {
    const tabs = guide.tabs(prefix);
    const count = tabs.length + 1;
    const base = {
      guideKey: guide.key,
      hubTitle: guide.title,
      group: guide.group ?? guide.key,
      headline: guide.headline,
    };
    return [
      {
        ...base,
        kind: "overview" as const,
        body: guide.body,
        anchor: `[data-section-guide-anchor="${guide.title}"]`,
        href: tabs.find((t) => t.href)?.href ?? "",
        label: guide.title,
        index: 0,
        count,
      },
      ...tabs.map((tab, i) => ({
        ...base,
        kind: "tab" as const,
        body: tab.detail,
        anchor: tab.anchor,
        href: tab.href ?? "",
        label: tab.label,
        index: i + 1,
        count,
      })),
    ];
  });
}

/** Open the guide on an area's overview. */
export function startSectionTour(guideKey: string) {
  const prefix = window.location.pathname.startsWith("/admin") ? "/admin" : "/coach";
  const first = buildSteps(prefix).findIndex((step) => step.guideKey === guideKey);
  writeState({ step: Math.max(0, first), sub: null });
}

/**
 * Walk the coach through these steps, one part of the page at a time. Used by
 * the top bar's "Finish About You" to point at each question still empty.
 */
export function startCustomTour(title: string, steps: PageTourStep[]) {
  if (steps.length) writeState({ step: 0, sub: 0, custom: { title, steps } });
}

/** A tab already open: links say aria-current, buttons carry data-tab-active. */
function isOpenTab(el: HTMLElement): boolean {
  return el.getAttribute("aria-current") === "page" || el.hasAttribute("data-tab-active");
}

function visible(selector: string | undefined): HTMLElement | null {
  if (!selector) return null;
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return null;
  const box = el.getBoundingClientRect();
  return box.width > 0 && box.height > 0 ? el : null;
}

/** What the card points at, and the words to show for it. */
function resolveAnchor(
  step: Step,
  pageStep: PageTourStep | null
): { el: HTMLElement | null; body: string | null } {
  if (pageStep) {
    const own = visible(pageStep.selector);
    // Still waiting on what the step opens (say, every chat is unread): use the "open one" words.
    const waiting = pageStep.prepare && !visible(pageStep.prepare.unless);
    if (own) return { el: own, body: waiting && pageStep.fallbackBody ? pageStep.fallbackBody : pageStep.body };
    const fallback = visible(pageStep.fallback);
    return { el: fallback, body: pageStep.fallbackBody ?? pageStep.body };
  }
  return { el: visible(step.anchor), body: null };
}

type Side = "below" | "above" | "right" | "left" | "inside";
type Place = { top: number; left: number; side: Side; caret: number } | null;

/** Below the part if it fits, then above, right, left; else inside its corner. */
function placeCard(box: DOMRect, cardHeight: number, preferBelowOnly: boolean): Place {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(CARD_WIDTH, vw - EDGE * 2);
  const clampX = (x: number) => Math.min(Math.max(x, EDGE), vw - width - EDGE);
  const clampY = (y: number) => Math.min(Math.max(y, EDGE), vh - cardHeight - EDGE);
  const xUnder = clampX(box.left - 12);
  const caretX = Math.min(Math.max(box.left + Math.min(box.width, 240) / 2 - xUnder, 18), width - 18);
  const fitsBelow = box.bottom + GAP + cardHeight <= vh - EDGE;
  if (preferBelowOnly || fitsBelow) {
    return { top: box.bottom + GAP, left: xUnder, side: "below", caret: caretX };
  }
  if (box.top - GAP - cardHeight >= EDGE) {
    return { top: box.top - GAP - cardHeight, left: xUnder, side: "above", caret: caretX };
  }
  const yBeside = clampY(box.top + 12);
  const caretY = Math.min(Math.max(box.top + 24 - yBeside, 18), cardHeight - 18);
  if (box.right + GAP + width <= vw - EDGE) {
    return { top: yBeside, left: box.right + GAP, side: "right", caret: caretY };
  }
  if (box.left - GAP - width >= EDGE) {
    return { top: yBeside, left: box.left - GAP - width, side: "left", caret: caretY };
  }
  return {
    top: clampY(box.top + 16),
    left: clampX(box.right - width - 16),
    side: "inside",
    caret: 0,
  };
}

const CARET_BASE = "absolute h-3 w-3 rotate-45 border-slate-200 bg-white";

export function SectionTour() {
  const router = useRouter();
  const pathname = usePathname();
  const prefix = pathname?.startsWith("/admin") ? "/admin" : "/coach";
  const steps = useMemo(() => buildSteps(prefix), [prefix]);
  const [state, setState] = useState<TourState>(null);
  const [place, setPlace] = useState<Place>(null);
  const [body, setBody] = useState<string | null>(null);
  /** Clear window in the dim while exploring a tab. */
  const [spot, setSpot] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const markedRef = useRef<HTMLElement | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setState(readState());
    const onChange = (e: Event) => setState((e as CustomEvent<TourState>).detail);
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
  }, []);

  const custom = state?.custom ?? null;
  const stepIndex = state?.step ?? null;
  // A custom guide stands alone: a made-up step with nothing to open or follow on.
  const customStep = useMemo<Step | null>(
    () =>
      custom
        ? { kind: "tab", guideKey: "custom", hubTitle: custom.title, group: "custom", headline: custom.title, body: "", anchor: "", href: "", label: custom.title, index: 1, count: 1 }
        : null,
    [custom]
  );
  const step = customStep ?? (stepIndex != null ? steps[stepIndex] ?? null : null);
  const pageSteps = custom
    ? custom.steps
    : step?.kind === "tab"
      ? PAGE_TOURS[`${step.guideKey}/${step.label}`] ?? null
      : null;
  const sub = state?.sub ?? null;
  const pageStep = sub != null && pageSteps ? pageSteps[sub] ?? null : null;

  // Example rows on empty pages while a page tour runs.
  useEffect(() => {
    setTourExamples(pageStep != null);
  }, [pageStep]);
  useEffect(() => () => setTourExamples(false), []);

  useEffect(() => {
    if (!step) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") writeState(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  // Glow on what the step is about and sit the card beside it.
  useLayoutEffect(() => {
    const unmark = () => {
      const el = markedRef.current;
      if (!el) return;
      el.style.outline = "";
      el.style.outlineOffset = "";
      el.style.borderRadius = "";
      el.style.boxShadow = "";
      markedRef.current = null;
    };
    if (!step) {
      unmark();
      setPlace(null);
      setSpot(null);
      return;
    }
    let scrolled = false;
    let prepared = false;
    // Open the step's tab: click it when it's on screen (that runs the
    // page's own tab switch), or go to its page when it isn't. Keep checking:
    // a slow page load from an earlier step can land after the click and
    // undo it, so try again (a few times, spaced out) until the tab is open.
    let tries = 0;
    let lastTry = 0;
    const update = () => {
      const now = Date.now();
      if (!pageStep && tries < 4 && now - lastTry > 2500) {
        const tabEl = visible(step.anchor);
        if (step.kind === "tab" && tabEl) {
          if (!isOpenTab(tabEl)) {
            tries += 1;
            lastTry = now;
            tabEl.click();
          }
        } else if (!tabEl && step.href) {
          tries += 1;
          lastTry = now;
          router.push(step.href, { scroll: false });
        }
      }
      // Open what this step needs (a read chat, the reply box) once.
      if (pageStep?.prepare && !prepared) {
        if (visible(pageStep.prepare.unless)) {
          prepared = true;
        } else {
          const target = visible(pageStep.prepare.click);
          if (target) {
            prepared = true;
            target.click();
          }
        }
      }
      const { el, body: nextBody } = resolveAnchor(step, pageStep);
      setBody(nextBody);
      if (el !== markedRef.current) {
        unmark();
        if (el) {
          markedRef.current = el;
          const big = el.getBoundingClientRect().height > 120;
          el.style.outline = "2px solid rgb(2 132 199 / 0.6)";
          el.style.outlineOffset = big ? "-2px" : "4px";
          el.style.borderRadius = "6px";
          el.style.boxShadow = big ? "" : "0 0 0 8px rgb(56 189 248 / 0.16)";
        }
      }
      if (el && pageStep && !scrolled) {
        scrolled = true;
        // Keep the part clear of the sticky title bar when the page scrolls to it.
        const header = document.querySelector("main [data-page-header]")?.getBoundingClientRect();
        const before = el.style.scrollMarginTop;
        el.style.scrollMarginTop = `${Math.max(0, header?.bottom ?? 0) + 12}px`;
        // Only scroll up and down: put back any sideways scroll (wide tables).
        const sideways: [Element, number][] = [];
        for (let p = el.parentElement; p; p = p.parentElement) {
          if (p.scrollLeft) sideways.push([p, p.scrollLeft]);
        }
        // A custom guide points at boxes to fill in: bring each one up under the title bar,
        // clear of the card (on phones the card sits at the bottom).
        el.scrollIntoView({ block: step.guideKey === "custom" ? "start" : "nearest", inline: "nearest" });
        el.style.scrollMarginTop = before;
        for (let p = el.parentElement; p; p = p.parentElement) {
          const kept = sideways.find(([box]) => box === p);
          p.scrollLeft = kept ? kept[1] : 0;
        }
      }
      if (pageStep && el) {
        const b = el.getBoundingClientRect();
        const pad = b.height > 120 ? 0 : 6;
        const next = { top: b.top - pad, left: b.left - pad, width: b.width + pad * 2, height: b.height + pad * 2 };
        setSpot((prev) =>
          prev &&
          prev.top === next.top &&
          prev.left === next.left &&
          prev.width === next.width &&
          prev.height === next.height
            ? prev
            : next
        );
      } else {
        setSpot(null);
      }
      if (!el || window.innerWidth < 768) {
        setPlace(null);
        return;
      }
      const next = placeCard(
        el.getBoundingClientRect(),
        cardRef.current?.offsetHeight ?? 280,
        !pageStep
      );
      setPlace((prev) =>
        prev &&
        next &&
        prev.top === next.top &&
        prev.left === next.left &&
        prev.side === next.side &&
        prev.caret === next.caret
          ? prev
          : next
      );
    };
    // Keep following the page for as long as the step is up: people click
    // around mid-tour and the part being shown can appear or move.
    update();
    const timer = window.setInterval(update, 250);
    window.addEventListener("resize", update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("resize", update);
      unmark();
    };
  }, [step, pageStep, pathname, router]);

  if (!step || stepIndex == null) return null;

  const prevStep = stepIndex > 0 ? steps[stepIndex - 1] : null;
  const nextStep = stepIndex < steps.length - 1 ? steps[stepIndex + 1] : null;

  let eyebrow: string;
  let title: string;
  let text: string;
  let dots: { count: number; at: number };
  let nextLabel: string;
  let onNext: () => void;
  let onBack: (() => void) | null;

  if (custom && pageStep && sub != null) {
    const lastSub = sub === custom.steps.length - 1;
    eyebrow = `${custom.title} · ${sub + 1} of ${custom.steps.length}`;
    title = pageStep.title;
    text = body ?? pageStep.body;
    dots = { count: custom.steps.length, at: sub };
    nextLabel = lastSub ? "Finish" : "Next";
    onNext = () => writeState(lastSub ? null : { step: 0, sub: sub + 1, custom });
    onBack = sub > 0 ? () => writeState({ step: 0, sub: sub - 1, custom }) : null;
  } else if (pageStep && pageSteps && sub != null) {
    eyebrow = `${step.label} · ${sub + 1} of ${pageSteps.length}`;
    title = pageStep.title;
    text = body ?? pageStep.body;
    dots = { count: pageSteps.length, at: sub };
    const lastSub = sub === pageSteps.length - 1;
    const goesOn = nextStep && nextStep.group === step.group;
    nextLabel = !lastSub
      ? "Next"
      : goesOn
        ? `Next tab: ${nextStep.kind === "overview" ? nextStep.hubTitle : nextStep.label}`
        : "Finish";
    onNext = () =>
      writeState(
        !lastSub
          ? { step: stepIndex, sub: sub + 1 }
          : goesOn
            ? { step: stepIndex + 1, sub: null }
            : null
      );
    onBack = () => writeState({ step: stepIndex, sub: sub === 0 ? null : sub - 1 });
  } else {
    eyebrow =
      step.kind === "overview"
        ? `${step.hubTitle} · ${step.count - 1} tabs`
        : `${step.hubTitle} · ${step.index} of ${step.count - 1}`;
    title = step.kind === "overview" ? step.headline : step.label;
    text = step.body;
    dots = { count: step.count, at: step.index };
    const goesOn = nextStep && nextStep.group === step.group;
    nextLabel = !goesOn
      ? "Finish"
      : nextStep.guideKey !== step.guideKey
        ? `Next: ${nextStep.hubTitle}`
        : step.kind === "overview"
          ? `Start: ${nextStep.label}`
          : "Next";
    onNext = () => writeState(goesOn ? { step: stepIndex + 1, sub: null } : null);
    onBack =
      prevStep && prevStep.group === step.group
        ? () => writeState({ step: stepIndex - 1, sub: null })
        : null;
  }

  const caret =
    place && place.side !== "inside" ? (
      <span
        aria-hidden
        style={
          place.side === "below" || place.side === "above"
            ? { left: place.caret - 6 }
            : { top: place.caret - 6 }
        }
        className={`${CARET_BASE} ${
          place.side === "below"
            ? "-top-[7px] border-l border-t"
            : place.side === "above"
              ? "-bottom-[7px] border-b border-r"
              : place.side === "right"
                ? "-left-[7px] border-b border-l"
                : "-right-[7px] border-r border-t"
        }`}
      />
    ) : null;

  return (
    <>
    {spot ? (
      // Light navy dim over everything but the part being shown. Clicks pass through.
      <div
        aria-hidden
        style={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height }}
        className="pointer-events-none fixed z-[79] rounded-md shadow-[0_0_0_9999px_rgba(5,30,54,0.32)] transition-all duration-300 ease-out"
      />
    ) : null}
    <div
      ref={cardRef}
      role="dialog"
      aria-label={`${step.hubTitle} guide`}
      style={place ? { top: place.top, left: place.left, width: CARD_WIDTH } : undefined}
      className={`fixed z-[80] rounded-lg border border-slate-200 bg-white p-5 shadow-[0_28px_64px_-12px_rgba(15,23,42,0.5),0_8px_20px_-8px_rgba(15,23,42,0.25)] ${
        place
          ? "max-w-[calc(100vw-2rem)]"
          : "inset-x-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:inset-x-auto md:bottom-6 md:right-6 md:w-[22rem]"
      }`}
    >
      {caret}
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-700">
          {eyebrow}
        </p>
        <button
          type="button"
          onClick={() => writeState(null)}
          className="-mr-1.5 -mt-1.5 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Close the guide"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <h2 className="mt-1 text-lg font-semibold leading-snug tracking-tight text-slate-900">
        {title}
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{text}</p>
      {!pageStep && pageSteps ? (
        <button
          type="button"
          onClick={() => writeState({ step: stepIndex, sub: 0 })}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-sky-700 hover:text-sky-900"
        >
          <Compass className="h-4 w-4" aria-hidden />
          Explore this tab
        </button>
      ) : null}
      <div className="mt-4 flex items-center gap-1.5" aria-hidden>
        {Array.from({ length: dots.count }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all ${
              i === dots.at ? "w-5 bg-sky-600" : i < dots.at ? "w-1.5 bg-sky-300" : "w-1.5 bg-slate-200"
            }`}
          />
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onBack?.()}
          disabled={!onBack}
          aria-label="Back"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:invisible"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
        >
          {nextLabel}
          {nextLabel !== "Finish" ? (
            <ArrowRight className="h-4 w-4" aria-hidden />
          ) : null}
        </button>
      </div>
    </div>
    </>
  );
}
