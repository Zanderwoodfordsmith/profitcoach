"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";
import type { BossGridInfoSection } from "@/lib/bossGridInfo";

const SHOW_DELAY_MS = 350;
const HIDE_DELAY_MS = 120;

export type BossGridInfoPanelHeader = {
  iconSrc: string;
  accentColor: string;
  eyebrow?: string;
  title: string;
};

type BossGridInfoIconProps = {
  title: string;
  sections: BossGridInfoSection[] | null;
  header?: BossGridInfoPanelHeader;
  /** Lighter icon for slate grid headers */
  variant?: "default" | "header";
  /** Wider tooltip with extra padding (levels) */
  panelSize?: "default" | "wide";
};

export function BossGridInfoIcon({
  title,
  sections,
  header,
  variant = "default",
  panelSize = "default",
}: BossGridInfoIconProps) {
  const tooltipId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const refreshAnchor = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setAnchor(rect);
  }, []);

  const show = useCallback(() => {
    clearTimers();
    showTimerRef.current = setTimeout(() => {
      showTimerRef.current = null;
      refreshAnchor();
      setOpen(true);
    }, SHOW_DELAY_MS);
  }, [clearTimers, refreshAnchor]);

  const hide = useCallback(() => {
    clearTimers();
    hideTimerRef.current = setTimeout(() => {
      hideTimerRef.current = null;
      setOpen(false);
    }, HIDE_DELAY_MS);
  }, [clearTimers]);

  const cancelHide = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  useEffect(() => {
    if (!open) return;
    refreshAnchor();
    const onScroll = () => refreshAnchor();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, refreshAnchor]);

  if (!sections?.length) return null;

  const iconClass =
    variant === "header"
      ? "text-white/30 transition hover:text-white/55 focus-visible:ring-white/30"
      : "text-slate-400/40 transition hover:text-slate-500/75 focus-visible:ring-sky-400/40";

  const isWide = panelSize === "wide";
  const panelWidthPx = isWide ? 416 : 352;
  const panelHalfWidth = panelWidthPx / 2;

  const panel =
    open && anchor && typeof document !== "undefined"
      ? createPortal(
          <div
            id={tooltipId}
            role="tooltip"
            className={`pointer-events-auto fixed z-[450] rounded-xl border bg-white shadow-lg ring-1 ring-slate-900/5 ${
              isWide
                ? "w-[min(26rem,calc(100vw-1.5rem))] px-6 py-5"
                : "w-[min(22rem,calc(100vw-1.5rem))] px-5 py-4"
            }`}
            style={{
              left: Math.max(
                12,
                Math.min(
                  anchor.left + anchor.width / 2 - panelHalfWidth,
                  window.innerWidth - panelWidthPx - 12
                )
              ),
              top: anchor.bottom + 10,
              borderColor: header ? `${header.accentColor}33` : "rgba(226, 232, 240, 0.9)",
              borderTopWidth: header ? 3 : 1,
              borderTopColor: header?.accentColor,
            }}
            onMouseEnter={cancelHide}
            onMouseLeave={hide}
          >
            {header ? (
              <div className="flex items-center gap-3.5 border-b border-slate-100 pb-4">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl"
                  style={{ backgroundColor: header.accentColor }}
                >
                  <div
                    className="h-8 w-8 shrink-0"
                    style={{
                      maskImage: `url(${header.iconSrc})`,
                      maskSize: "contain",
                      maskRepeat: "no-repeat",
                      maskPosition: "center",
                      WebkitMaskImage: `url(${header.iconSrc})`,
                      WebkitMaskSize: "contain",
                      WebkitMaskRepeat: "no-repeat",
                      WebkitMaskPosition: "center",
                      backgroundColor: "white",
                    }}
                    aria-hidden
                  />
                </div>
                <div className="min-w-0">
                  {header.eyebrow ? (
                    <p
                      className="text-xs font-semibold uppercase tracking-wide"
                      style={{ color: header.accentColor }}
                    >
                      {header.eyebrow}
                    </p>
                  ) : null}
                  <p className="text-base font-semibold text-slate-900">{header.title}</p>
                </div>
              </div>
            ) : (
              <p className="text-base font-semibold text-slate-900">{title}</p>
            )}
            <div className={`${header ? (isWide ? "mt-5" : "mt-4") : "mt-3"} ${isWide ? "space-y-[1.125rem]" : "space-y-3"}`}>
              {sections.map((section) => (
                <div key={section.label}>
                  <p
                    className={`text-xs font-semibold uppercase tracking-wide ${
                      isWide ? "mt-0.5 text-slate-700" : "text-slate-500"
                    }`}
                  >
                    {section.label}
                  </p>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-slate-700">{section.body}</p>
                </div>
              ))}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 ${iconClass}`}
        aria-label={`About ${title}`}
        aria-describedby={open ? tooltipId : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <Info className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
      </button>
      {panel}
    </>
  );
}
