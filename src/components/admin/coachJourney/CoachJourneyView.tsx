"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { CoachesHubTabs } from "@/components/admin/CoachesHubTabs";
import { StickyPageHeader } from "@/components/layout";
import { SectionInfoTip } from "@/components/settings/IntegrationsSettingsTab";
import { BUILD_STATUS_LABEL, JOURNEY_MOMENTS, JOURNEY_PHASES, type BuildStatus } from "@/lib/activation/coachJourney";
import { COACH_JOURNEY_NOTES } from "@/lib/activation/coachJourneyNotes";

import { JourneyOutputs } from "./JourneyOutputs";
import { JourneyPicture } from "./JourneyPicture";
import { JourneyTable, STATUS_DOT } from "./JourneyTable";

/** Selected toggle option: solid bright blue with white text (house rule). */
const TOGGLE_ON = "bg-sky-600 text-white";
const TOGGLE_OFF = "text-slate-600 hover:bg-slate-100 hover:text-slate-900";

type JourneyView = "table" | "picture" | "outputs" | "notes";

function JourneyNotes() {
  return (
    <article className="max-w-3xl rounded-lg border border-slate-200 bg-white px-6 py-5 text-sm leading-relaxed text-slate-700">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children }) => <h2 className="mb-2 mt-6 text-base font-semibold text-slate-900 first:mt-0">{children}</h2>,
          p: ({ children }) => <p className="mb-3">{children}</p>,
          ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1.5 pl-5">{children}</ol>,
          strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
          a: ({ children, href }) => (
            <a href={href} className="text-sky-700 underline underline-offset-2 hover:text-sky-900" target={href?.startsWith("/") ? undefined : "_blank"} rel="noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {COACH_JOURNEY_NOTES}
      </ReactMarkdown>
    </article>
  );
}

export function CoachJourneyView() {
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerH, setHeaderH] = useState(0);
  // The table's lane headings stick just under the page header.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeaderH(el.getBoundingClientRect().height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const [view, setView] = useState<JourneyView>("table");
  const [closedPhases, setClosedPhases] = useState<Set<string>>(() => new Set());
  const [jumpTo, setJumpTo] = useState<string | null>(null);
  const allClosed = closedPhases.size === JOURNEY_PHASES.length;
  const togglePhase = (id: string) =>
    setClosedPhases((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // From the picture: open that phase in the table and scroll to it.
  const openPhase = (id: string) => {
    setClosedPhases((cur) => {
      const next = new Set(cur);
      next.delete(id);
      return next;
    });
    setView("table");
    setJumpTo(id);
  };
  useEffect(() => {
    if (!jumpTo || view !== "table") return;
    const frame = requestAnimationFrame(() => {
      document.getElementById(`journey-phase-${jumpTo}`)?.scrollIntoView({ block: "start", behavior: "smooth" });
      setJumpTo(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [jumpTo, view]);

  const counts = useMemo(() => {
    const c: Record<BuildStatus, number> = { live: 0, partly: 0, build: 0 };
    for (const m of JOURNEY_MOMENTS) for (const step of Object.values(m.lanes)) if (step) c[step.status] += 1;
    return c;
  }, []);

  const toggle = (id: JourneyView, label: string) => (
    <button
      type="button"
      onClick={() => setView(id)}
      className={`rounded-md px-3 py-1 text-sm font-medium ${view === id ? TOGGLE_ON : TOGGLE_OFF}`}
      aria-pressed={view === id}
    >
      {label}
    </button>
  );

  return (
    <>
      <StickyPageHeader title="Coaches" tabs={<CoachesHubTabs />} rootRef={headerRef} />
      <div className="flex min-w-0 flex-col gap-3" style={{ ["--journey-top" as string]: `${headerH}px` }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5">
            {toggle("table", "Table")}
            {toggle("picture", "Picture")}
            {toggle("outputs", "Outputs")}
            {toggle("notes", "Notes")}
          </div>
          {view === "table" ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1">
                {JOURNEY_MOMENTS.length} moments, payment to month 7
                <SectionInfoTip
                  label="Days"
                  text="Moments fire when something happens, or when it hasn't by the target day. Days count from joining; L+14 means 14 days after launch (the first invite or campaign send)."
                  wide
                />
              </span>
              {(Object.keys(counts) as BuildStatus[]).map((s) => (
                <span key={s} className="inline-flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${STATUS_DOT[s]}`} aria-hidden />
                  {BUILD_STATUS_LABEL[s]} {counts[s]}
                </span>
              ))}
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-4 rounded-sm bg-amber-50 ring-1 ring-inset ring-amber-200" aria-hidden />
                If it hasn&apos;t happened
              </span>
              <button
                type="button"
                onClick={() => setClosedPhases(allClosed ? new Set() : new Set(JOURNEY_PHASES.map((p) => p.id)))}
                className="font-medium text-[#0C5290] hover:underline"
              >
                {allClosed ? "Expand all" : "Collapse all"}
              </button>
            </div>
          ) : null}
        </div>

        {view === "table" ? (
          <JourneyTable closed={closedPhases} onTogglePhase={togglePhase} />
        ) : view === "picture" ? (
          <JourneyPicture onOpenPhase={openPhase} />
        ) : view === "outputs" ? (
          <JourneyOutputs />
        ) : (
          <JourneyNotes />
        )}
      </div>
    </>
  );
}
