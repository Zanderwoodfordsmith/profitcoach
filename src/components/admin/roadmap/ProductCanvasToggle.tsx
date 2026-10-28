"use client";

import { useSyncExternalStore } from "react";

/**
 * Product's background, side by side until Zander picks (26 Oct): the clean
 * near-white Curriculum uses, or the app's blue-grey gradient. Remove this
 * switch and the one he passes on once he's chosen.
 */

export type ProductCanvas = "white" | "gradient";

const KEY = "product-canvas";
const EVENT = "product-canvas-change";

function read(): ProductCanvas {
  try {
    return window.localStorage.getItem(KEY) === "gradient" ? "gradient" : "white";
  } catch {
    return "white";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useProductCanvas(): ProductCanvas {
  return useSyncExternalStore(subscribe, read, () => "white");
}

export function ProductCanvasToggle() {
  const canvas = useProductCanvas();
  const pick = (next: ProductCanvas) => {
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      // Remembering the pick is only a convenience.
    }
    window.dispatchEvent(new Event(EVENT));
  };
  return (
    <div className="hidden items-center gap-1.5 text-xs text-slate-500 md:flex" title="Comparing backgrounds: pick one and the other goes">
      <span>Background</span>
      <div className="inline-flex rounded-full bg-slate-200/60 p-0.5">
        {(["white", "gradient"] as const).map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={canvas === c}
            onClick={() => pick(c)}
            className={`rounded-full px-2.5 py-0.5 font-medium transition ${
              canvas === c ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {c === "white" ? "White" : "Gradient"}
          </button>
        ))}
      </div>
    </div>
  );
}
