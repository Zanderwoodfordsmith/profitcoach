"use client";

import { Loader2, Sparkles } from "lucide-react";

export function ReplyCopilotButton({
  loading,
  disabled,
  onClick,
}: {
  loading: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      aria-label={loading ? "Drafting a reply" : "Suggest a reply"}
      title={loading ? "Drafting…" : "Suggest a reply"}
      className="absolute bottom-2 right-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-sky-600 text-white shadow-sm transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-white"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <Sparkles className="h-4 w-4" aria-hidden />
      )}
    </button>
  );
}
