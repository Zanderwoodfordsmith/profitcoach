"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ArrowUp,
  AudioLines,
  BookOpen,
  Compass,
  Home,
  LayoutGrid,
  Library,
  Maximize2,
  Mic,
  PenLine,
  Plus,
  Rocket,
  Search,
  Settings,
  Target,
  Users,
  X,
} from "lucide-react";

import { figtree } from "@/fonts";

import { AvaMark, type MarkId } from "./marks";

/* ------------------------------------------------------------ Frames */

/**
 * Draws its children at a real device size (a 1440 by 900 laptop, a
 * 390 by 844 phone) and scales the whole thing to fit the column, so every
 * option is judged at true proportions. "Full size" opens it over the page.
 */
export function Screen({
  w = 1440,
  h = 900,
  phone = false,
  label,
  children,
}: {
  w?: number;
  h?: number;
  phone?: boolean;
  label: string;
  children: ReactNode;
}) {
  const box = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.5);
  const [full, setFull] = useState(false);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, el.clientWidth / w));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [w]);

  return (
    <div ref={box} className="relative flex w-full flex-col items-end" style={{ maxWidth: phone ? 340 : undefined }}>
      <div className={`ad-frame ${phone ? "phone" : ""}`} style={{ width: w * scale, height: h * scale }}>
        <div
          style={{
            width: w,
            height: h,
            transform: `scale(${scale})`,
            transformOrigin: "0 0",
            position: "relative",
          }}
        >
          {children}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setFull(true)}
        className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold text-[var(--blue)] hover:bg-[var(--mist)]"
        style={phone ? { marginTop: 22 } : undefined}
        aria-label={`Open ${label} full size`}
      >
        <Maximize2 className="h-3.5 w-3.5" aria-hidden /> Full size
      </button>
      {full ? (
        <FullSize w={w} h={h} phone={phone} onClose={() => setFull(false)}>
          {children}
        </FullSize>
      ) : null}
    </div>
  );
}

function FullSize({ w, h, phone, onClose, children }: { w: number; h: number; phone: boolean; onClose: () => void; children: ReactNode }) {
  const [vp, setVp] = useState({ w: 1440, h: 900 });
  useEffect(() => {
    const fit = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    fit();
    window.addEventListener("resize", fit);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", fit);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  const s = Math.min(1, (vp.w - 48) / w, (vp.h - 48) / h);
  return createPortal(
    <div className={`ad ad-full ${figtree.className}`} onClick={onClose} role="dialog" aria-modal="true" aria-label="Full size preview">
      <div onClick={(e) => e.stopPropagation()} className={`ad-frame ${phone ? "phone" : ""}`} style={{ width: w * s, height: h * s }}>
        <div
          style={{
            width: w,
            height: h,
            transform: `scale(${s})`,
            transformOrigin: "0 0",
            position: "relative",
          }}
        >
          {children}
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="fixed right-5 top-5 grid h-10 w-10 place-items-center rounded-full bg-white text-[var(--ink)]"
        aria-label="Close"
      >
        <X className="h-5 w-5" aria-hidden />
      </button>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------ App chrome */

const NAV = [
  { icon: Home, label: "Home" },
  { icon: LayoutGrid, label: "Blueprint" },
  { icon: Target, label: "Get clients" },
  { icon: Users, label: "Keep clients" },
  { icon: BookOpen, label: "Classroom" },
  { icon: Library, label: "Vault" },
  { icon: Compass, label: "Community" },
];

/** Just the Profit Coach icon, cut from the full logo file. */
export function LogoIcon({ white, size = 26 }: { white?: boolean; size?: number }) {
  const k = size / 24;
  return (
    <span className="mb-5 block overflow-hidden" style={{ width: 26 * k, height: 24 * k }} aria-label="The Profit Coach" role="img">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={white ? "/brand/profit-coach-logo-white.svg" : "/profit-coach-logo.svg"}
        alt=""
        style={{
          height: 54 * k,
          width: "auto",
          maxWidth: "none",
          marginLeft: -15 * k,
          marginTop: -15 * k,
        }}
      />
    </span>
  );
}

/** The app's left rail, slim, as the coach would see it with Ava open. */
export function AppRail({ tone, mark, dark }: { tone: "glass" | "brand" | "clear"; mark: MarkId; dark?: boolean }) {
  const brand = tone === "brand";
  const bg =
    tone === "brand"
      ? "linear-gradient(165deg, #051e36 0%, #0c5290 48%, #1a8fd4 100%)"
      : tone === "glass"
        ? dark
          ? "rgba(255,255,255,0.04)"
          : "rgba(255,255,255,0.55)"
        : "transparent";
  const fg = brand || dark ? "rgba(234,244,252,0.72)" : "#5a6b80";
  return (
    <aside
      className="relative z-[2] flex h-full w-[76px] shrink-0 flex-col items-center gap-2 py-5"
      style={{
        background: bg,
        backdropFilter: tone === "glass" ? "blur(24px)" : undefined,
        borderRight: tone === "glass" ? `1px solid ${dark ? "rgba(207,230,248,0.1)" : "rgba(255,255,255,0.9)"}` : undefined,
      }}
    >
      <LogoIcon white={brand || dark} />
      {NAV.map(({ icon: Icon, label }) => (
        <span key={label} className="grid h-11 w-11 place-items-center rounded-xl" style={{ color: fg }} title={label}>
          <Icon className="h-[19px] w-[19px]" strokeWidth={1.7} aria-hidden />
        </span>
      ))}
      <span
        className="mt-3 grid h-11 w-11 place-items-center rounded-xl"
        style={{
          background: brand || dark ? "rgba(255,255,255,0.14)" : "#ffffff",
          boxShadow: brand || dark ? "inset 0 1px 0 rgba(255,255,255,0.2)" : "0 4px 14px -6px rgba(12,82,144,0.4)",
        }}
        title="Ava"
      >
        <AvaMark id={mark} size={22} dark={brand || dark} />
      </span>
      <span className="mt-auto grid h-11 w-11 place-items-center" style={{ color: fg }}>
        <Settings className="h-[19px] w-[19px]" strokeWidth={1.7} aria-hidden />
      </span>
      <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-[#cfe6f8] text-[13px] font-bold text-[#051e36]">
        ZW
      </span>
    </aside>
  );
}

/* ------------------------------------------------------------ Composer */

export const STARTERS = [
  { icon: Search, label: "Find prospects" },
  { icon: Rocket, label: "Launch a campaign" },
  { icon: PenLine, label: "Write a LinkedIn post" },
  { icon: Mic, label: "Practise my pitch" },
  { icon: LayoutGrid, label: "Finish my Blueprint" },
];

/**
 * The chat box. "glass" is the light frosted box with a bright edge;
 * "dark" is the black reference's smoked glass; "cream" is the Doer pill.
 */
export function Composer({
  variant,
  width = 720,
  placeholder = "Ask Ava anything, or tell her what to do",
  context,
  tall = true,
}: {
  variant: "glass" | "dark" | "cream";
  width?: number | string;
  placeholder?: string;
  context?: string;
  tall?: boolean;
}) {
  const dark = variant === "dark";
  const cls = variant === "glass" ? "ad-glass ad-edge" : variant === "dark" ? "ad-glass-dark ad-edge" : "";
  const style =
    variant === "cream"
      ? {
          background: "#fbfaf6",
          boxShadow: "0 1px 0 rgba(255,255,255,0.9) inset, 0 18px 40px -24px rgba(5,30,54,0.45)",
          border: "1px solid rgba(5,30,54,0.06)",
        }
      : undefined;
  return (
    <div className={`${dark ? "dark" : ""}`} style={{ width }}>
      <div className={`${cls} rounded-[26px] px-5 pb-3 pt-4`} style={style}>
        <div
          className={`${tall ? "min-h-[64px]" : "min-h-[28px]"} text-[16px]`}
          style={{ color: dark ? "rgba(234,244,252,0.55)" : "#7d8ca0" }}
        >
          {placeholder}
        </div>
        <div className="mt-2 flex items-center gap-1">
          <span className="ad-icon-btn" aria-label="Add a file">
            <Plus className="h-[18px] w-[18px]" aria-hidden />
          </span>
          {context ? <span className="ad-chip ml-1">{context}</span> : null}
          <span className="ml-auto ad-icon-btn" aria-label="Dictate">
            <Mic className="h-[18px] w-[18px]" aria-hidden />
          </span>
          <span className="ad-icon-btn" aria-label="Talk to Ava">
            <AudioLines className="h-[18px] w-[18px]" aria-hidden />
          </span>
          <span className="ad-send ml-1" aria-label="Send">
            <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.2} aria-hidden />
          </span>
        </div>
      </div>
    </div>
  );
}

export function Starters({ kind, dark, items = STARTERS }: { kind: "pill" | "tile"; dark?: boolean; items?: typeof STARTERS }) {
  return (
    <div className={`flex flex-wrap justify-center gap-2.5 ${dark ? "dark" : ""}`}>
      {items.map(({ icon: Icon, label }) => (
        <span key={label} className={kind === "pill" ? "ad-pill" : "ad-tile"}>
          <Icon className="h-4 w-4" strokeWidth={1.9} aria-hidden />
          {label}
        </span>
      ))}
    </div>
  );
}

/** BCA two-weight headline: a light slate line, then a bold ink line. */
export function TwoWeight({
  light,
  bold,
  dark,
  size = 44,
  align = "center",
}: {
  light: string;
  bold: string;
  dark?: boolean;
  size?: number;
  align?: "center" | "left";
}) {
  return (
    <h2 className="leading-[1.08] tracking-[-0.025em]" style={{ fontSize: size, textAlign: align, textWrap: "balance" }}>
      <span className="block font-light" style={{ color: dark ? "rgba(207,230,248,0.8)" : "#5a6b80" }}>
        {light}
      </span>
      <span className="block font-bold" style={{ color: dark ? "#ffffff" : "#0b1b2e" }}>
        {bold}
      </span>
    </h2>
  );
}

export function Typing() {
  return (
    <span className="ad-typing" aria-label="Ava is typing">
      <span />
      <span />
      <span />
    </span>
  );
}
