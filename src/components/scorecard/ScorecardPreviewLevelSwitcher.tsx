"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PREVIEW_LEVEL_OPTIONS } from "@/lib/bossScorecardScores";

export function ScorecardPreviewLevelSwitcher({
  floating = false,
}: {
  floating?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const scoreParam = searchParams?.get("score");
  const currentScore = scoreParam ? parseInt(scoreParam, 10) : null;
  const current =
    PREVIEW_LEVEL_OPTIONS.find((o) => o.targetScore === currentScore) ??
    PREVIEW_LEVEL_OPTIONS.find((o) => !scoreParam && o.level === "Organised") ??
    PREVIEW_LEVEL_OPTIONS[2];

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const el = rootRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function selectLevel(targetScore: number) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("score", String(targetScore));
    params.set("preview", "1");
    router.push(`${pathname}?${params.toString()}`);
    setOpen(false);
  }

  function selectNatural() {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.delete("score");
    params.set("preview", "1");
    router.push(`${pathname}?${params.toString()}`);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full min-w-0 items-center gap-1 rounded-lg border px-3 py-1.5 text-left ${
          floating
            ? "border-amber-200/80 bg-amber-50/50 shadow-sm"
            : "max-w-[11rem] border-slate-200 bg-white shadow-sm sm:max-w-[14rem]"
        }`}
        title="Preview a BOSS level"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="min-w-0 truncate text-xs font-semibold text-slate-700">
          {scoreParam ? current.label : "Mixed preview"}
        </span>
        <ChevronDown
          className={`ml-auto h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open ? (
        <div
          className={`absolute right-0 z-[110] w-[min(16rem,calc(100vw-5rem))] rounded-lg border border-slate-200 bg-white py-1 shadow-lg ring-1 ring-black/5 ${
            floating
              ? "bottom-[calc(100%+6px)]"
              : "top-[calc(100%+6px)]"
          }`}
          role="listbox"
          aria-label="Preview levels"
        >
          <button
            type="button"
            role="option"
            aria-selected={!scoreParam}
            onClick={selectNatural}
            className={`flex w-full flex-col items-start px-3 py-2 text-left text-xs transition-colors ${
              !scoreParam
                ? "bg-sky-50 text-sky-950"
                : "text-slate-800 hover:bg-slate-50"
            }`}
          >
            <span className="font-medium">Mixed preview</span>
            <span className="mt-0.5 text-[10px] text-slate-500">
              Varied area scores
            </span>
          </button>
          <div className="my-1 border-t border-slate-100" />
          {PREVIEW_LEVEL_OPTIONS.map((opt) => {
            const active = currentScore === opt.targetScore;
            return (
              <button
                key={opt.level}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => selectLevel(opt.targetScore)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${
                  active
                    ? "bg-sky-50 text-sky-950"
                    : "text-slate-800 hover:bg-slate-50"
                }`}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: opt.color }}
                />
                <span className="font-medium">{opt.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
