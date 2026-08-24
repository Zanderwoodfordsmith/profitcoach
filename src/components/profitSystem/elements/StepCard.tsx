"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  PS_TONES,
  type DiagramIcon,
  type PsTone,
} from "../profitSystemData";
import { AreaIcon } from "./AreaIcon";

/**
 * The Profit System step/element card (from the brand references):
 * colored header band with eyebrow + chevron, icon body, bold title,
 * optional transformation footer strip.
 */
export function StepCard({
  eyebrow,
  title,
  icon,
  tone = "navy",
  chevron = "right",
  footer,
  accent = "none",
  className,
}: {
  eyebrow: string;
  title: string;
  icon: DiagramIcon;
  tone?: PsTone;
  chevron?: "right" | "left" | "none";
  footer?: string;
  accent?: "out" | "in" | "none";
  className?: string;
}) {
  const t = PS_TONES[tone];
  return (
    <div
      className={`flex w-44 flex-col overflow-hidden rounded-xl bg-white shadow-[0_14px_34px_-18px_rgba(12,82,144,0.45)] ring-1 ring-slate-200/70 ${className ?? ""}`}
    >
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ backgroundColor: t.base }}
      >
        <span className="text-xs font-bold text-white">{eyebrow}</span>
        {chevron === "right" ? (
          <ChevronRight className="h-3.5 w-3.5 text-white" strokeWidth={3} />
        ) : chevron === "left" ? (
          <ChevronLeft className="h-3.5 w-3.5 text-white" strokeWidth={3} />
        ) : null}
      </div>
      <div className="flex flex-1 flex-col items-center gap-2.5 px-3 py-5">
        <AreaIcon
          icon={icon}
          accent={accent}
          accentColor={PS_TONES.blue.base}
          className="h-14 w-14"
        />
        <p className="text-center text-[13px] font-bold leading-snug text-slate-900">
          {title}
        </p>
      </div>
      {footer ? (
        <div
          className="px-3 py-1.5 text-center text-[10px] font-semibold text-white/95"
          style={{ backgroundColor: t.dark }}
        >
          {footer}
        </div>
      ) : null}
    </div>
  );
}
