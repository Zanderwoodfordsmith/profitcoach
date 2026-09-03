"use client";

import Link from "next/link";
import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  Compass,
  Handshake,
  ListFilter,
  MessageCircle,
  PhoneCall,
  RefreshCw,
  Repeat2,
  Route,
  Search,
  Sparkles,
  Target,
  Users,
} from "lucide-react";

import type {
  GrowthMapNode,
  GrowthMapRow,
  GrowthMapSection,
} from "@/lib/academy/growthSystemMap";

const ICONS: Record<GrowthMapNode["icon"], LucideIcon> = {
  target: Target,
  search: Search,
  list: ListFilter,
  message: MessageCircle,
  badge: BadgeCheck,
  calendar: CalendarDays,
  users: Users,
  repeat: Repeat2,
  phone: PhoneCall,
  handshake: Handshake,
  sparkles: Sparkles,
  clipboard: ClipboardCheck,
  compass: Compass,
  refresh: RefreshCw,
};

const SECTION_STYLES: Record<
  GrowthMapSection["id"],
  {
    accent: string;
    accentSoft: string;
    icon: LucideIcon;
    line: string;
  }
> = {
  "get-calls": {
    accent: "text-[#0c5290]",
    accentSoft: "bg-[#0c5290]/10 text-[#0c5290]",
    icon: Route,
    line: "bg-[#0c5290]",
  },
  "win-clients": {
    accent: "text-[#2f86c6]",
    accentSoft: "bg-[#42a1ee]/12 text-[#0c5290]",
    icon: Handshake,
    line: "bg-[#42a1ee]",
  },
  "coach-clients": {
    accent: "text-[#138aa7]",
    accentSoft: "bg-[#1ca0c2]/10 text-[#087890]",
    icon: Compass,
    line: "bg-[#1ca0c2]",
  },
};

export function GrowthSystemMap({
  sections,
}: {
  sections: GrowthMapSection[];
}) {
  const [openSections, setOpenSections] = useState(
    () => new Set(sections.map((section) => section.id)),
  );

  function toggleSection(sectionId: GrowthMapSection["id"]) {
    setOpenSections((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 pb-16 pt-3">
      <header className="relative overflow-hidden rounded-[30px] border border-white/80 bg-white/70 px-6 py-7 shadow-[0_18px_50px_rgba(15,23,42,0.11)] ring-1 ring-inset ring-white/70 sm:px-9 sm:py-9">
        <div
          className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-sky-300/20 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-cyan-300/15 blur-3xl"
          aria-hidden
        />
        <div className="relative max-w-3xl">
          <h1 className="max-w-2xl text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-4xl">
            Here is how your coaching business grows
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
            Start with the right people. Turn conversations into clients. Then
            deliver work that creates progress.
          </p>
        </div>

        <nav
          className="relative mt-7 flex flex-wrap items-center gap-2 text-sm"
          aria-label="Growth system steps"
        >
          {sections.map((section, index) => {
            const style = SECTION_STYLES[section.id];
            return (
              <div key={section.id} className="flex items-center gap-2">
                <a
                  href={`#${section.id}`}
                  className={`inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-white/80 px-3.5 py-2 font-semibold shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow ${style.accent} focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2`}
                >
                  <span
                    className={`grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold text-white ${style.line}`}
                  >
                    {index + 1}
                  </span>
                  {section.title}
                </a>
                {index < sections.length - 1 ? (
                  <ArrowRight
                    className="hidden h-4 w-4 text-slate-300 sm:block"
                    aria-hidden
                  />
                ) : null}
              </div>
            );
          })}
        </nav>
      </header>

      <div className="flex flex-col gap-6">
        {sections.map((section) => (
          <GrowthSystemSection
            key={section.id}
            section={section}
            open={openSections.has(section.id)}
            onToggle={() => toggleSection(section.id)}
          />
        ))}
      </div>
    </div>
  );
}

function GrowthSystemSection({
  section,
  open,
  onToggle,
}: {
  section: GrowthMapSection;
  open: boolean;
  onToggle: () => void;
}) {
  const style = SECTION_STYLES[section.id];
  const SectionIcon = style.icon;

  return (
    <section
      id={section.id}
      aria-labelledby={`${section.id}-title`}
      className="scroll-mt-28 overflow-hidden rounded-[28px] border border-white/90 bg-white/75 shadow-[0_16px_45px_rgba(15,23,42,0.09)] ring-1 ring-inset ring-white/70"
    >
      <div className="relative p-5 sm:p-7">
        <div className={`absolute inset-x-0 top-0 h-1 ${style.line}`} aria-hidden />
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div
              className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${style.accentSoft}`}
            >
              <SectionIcon className="h-6 w-6" strokeWidth={1.8} aria-hidden />
            </div>
            <div className="min-w-0">
              <h2
                id={`${section.id}-title`}
                className="text-2xl font-semibold tracking-[-0.025em] text-slate-950 sm:text-3xl"
              >
                {section.title}
              </h2>
              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                {section.description}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 pl-16 lg:pl-0">
            {section.id === "get-calls" ? (
              <Link
                href="/admin/academy/classroom/system"
                className={`hidden rounded-full px-3.5 py-2 text-sm font-semibold transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 sm:inline-flex ${style.accent}`}
              >
                View system map
              </Link>
            ) : null}
            <Link
              href={section.href}
              className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 ${style.accent}`}
            >
              Open course
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={open}
              aria-controls={`${section.id}-content`}
              className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2"
              aria-label={`${open ? "Collapse" : "Expand"} ${section.title}`}
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
                aria-hidden
              />
            </button>
          </div>
        </div>
      </div>

      {open ? (
        <div
          id={`${section.id}-content`}
          className="border-t border-slate-200/80 px-5 pb-6 sm:px-7 sm:pb-8"
        >
          {section.id === "get-calls" ? (
            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200/90 bg-slate-50/50">
              {section.rows.map((row, index) => (
                <WorkflowRow
                  key={row.id}
                  row={row}
                  tone={style}
                  first={index === 0}
                  last={index === section.rows.length - 1}
                />
              ))}
            </div>
          ) : (
            <div className="mt-5">
              {section.rows.map((row) => (
                <WorkflowRow key={row.id} row={row} tone={style} first last />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

function WorkflowRow({
  row,
  tone,
  first = false,
  last = false,
}: {
  row: GrowthMapRow;
  tone: (typeof SECTION_STYLES)[GrowthMapSection["id"]];
  first?: boolean;
  last?: boolean;
}) {
  return (
    <div
      className={`${first ? "" : "border-t border-slate-200/80"} ${last ? "pb-1" : ""} px-4 py-5 sm:px-5 sm:py-6`}
    >
      <div className="mt-4 flex flex-col gap-4 xl:flex-row xl:items-center xl:gap-8">
        <div className="w-full shrink-0 xl:w-52">
          <h3 className={`text-base font-semibold ${tone.accent}`}>{row.title}</h3>
          <p className="mt-1 text-sm leading-5 text-slate-500">{row.description}</p>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-stretch gap-2.5">
            {row.nodes.map((node, index) => (
              <div
                key={`${node.id}-${node.title}`}
                className="flex w-full min-w-0 items-stretch gap-2.5 sm:w-[calc(50%-0.625rem)] xl:w-auto xl:flex-1"
              >
                <GrowthMapNodeView node={node} tone={tone} />
                {index < row.nodes.length - 1 ? (
                  <ArrowRight
                    className="hidden h-4 w-4 shrink-0 text-slate-300 lg:block"
                    aria-hidden
                  />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function GrowthMapNodeView({
  node,
  tone,
}: {
  node: GrowthMapNode;
  tone: (typeof SECTION_STYLES)[GrowthMapSection["id"]];
}) {
  const NodeIcon = ICONS[node.icon];
  const className =
    "group flex h-full min-h-[118px] w-full min-w-0 flex-1 items-start gap-3 rounded-2xl border px-4 py-3.5 text-left transition sm:min-w-[190px]";
  const availableClassName =
    "border-slate-200/90 bg-white shadow-[0_5px_16px_rgba(15,23,42,0.05)] hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_10px_22px_rgba(15,23,42,0.09)] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2";
  const unavailableClassName =
    "border-dashed border-slate-300 bg-slate-100/60 text-slate-400";

  const content = (
    <>
      <span
        className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
          node.status === "available" ? tone.accentSoft : "bg-slate-200 text-slate-400"
        }`}
      >
        <NodeIcon className="h-4 w-4" strokeWidth={1.8} aria-hidden />
      </span>
      <span className="min-w-0">
        <span
          className={`block text-[15px] font-semibold leading-5 ${
            node.status === "available" ? "text-slate-800" : "text-slate-500"
          }`}
        >
          {node.title}
        </span>
        <span className="mt-1 block text-sm leading-5 text-slate-500">
          {node.description}
        </span>
        <span
          className={`mt-2 inline-flex items-center gap-1 text-xs font-semibold ${
            node.status === "available" ? tone.accent : "text-slate-400"
          }`}
        >
          {node.status === "available" ? (
            <>
              Open lesson
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </>
          ) : (
            "Coming soon"
          )}
        </span>
      </span>
    </>
  );

  if (!node.href) {
    return (
      <div className={`${className} ${unavailableClassName}`} aria-disabled="true">
        {content}
      </div>
    );
  }

  return (
    <Link href={node.href} className={`${className} ${availableClassName}`}>
      {content}
    </Link>
  );
}
