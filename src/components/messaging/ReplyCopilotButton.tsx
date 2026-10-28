"use client";

import { Loader2 } from "lucide-react";
import { AvaHalo } from "@/components/ava/AvaHalo";

export function ReplyCopilotButton({
  loading,
  disabled,
  onClick,
  position = "absolute bottom-2 right-2 z-10",
}: {
  loading: boolean;
  disabled?: boolean;
  onClick: () => void;
  /** Where it sits. Defaults to the bottom-right corner of the composer. */
  position?: string;
}) {
  return (
    <button
      type="button"
      // Keep focus where it is: a focus change can re-render the composer and swallow the click.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled || loading}
      aria-label={loading ? "Drafting a reply" : "Suggest a reply"}
      title={loading ? "Drafting…" : "Suggest a reply"}
      className={`${position} inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#051e36] text-white shadow-sm transition hover:bg-[#0a3a66] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-white`}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <AvaHalo size={18} dark className="shrink-0" />
      )}
    </button>
  );
}
