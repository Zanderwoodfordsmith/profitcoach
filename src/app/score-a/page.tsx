"use client";

import { Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

const SESSION_COOKIE = "landing_session_id";

function getOrSetSessionId(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp(`(?:^| )${SESSION_COOKIE}=([^;]+)`));
  if (match) return match[1];
  const id = crypto.randomUUID?.() ?? `s${Date.now()}-${Math.random().toString(36).slice(2)}`;
  document.cookie = `${SESSION_COOKIE}=${id};path=/;max-age=2592000`;
  return id;
}

function ScoreAContent() {
  const searchParams = useSearchParams();
  const viewTracked = useRef(false);
  const query = searchParams.toString();
  const iframeSrc = `/boss-exact/BOSS%20Assessment.html${query ? `?${query}` : ""}`;

  useEffect(() => {
    if (viewTracked.current) return;
    viewTracked.current = true;
    const coachSlug = searchParams.get("coach")?.trim() || "BCA";
    const sessionId = getOrSetSessionId();
    fetch("/api/landing/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        variant: "a",
        coach_slug: coachSlug || null,
        event_type: "view",
        session_id: sessionId,
      }),
    }).catch(() => {});
  }, [searchParams]);

  return (
    <div className="relative min-h-screen bg-[#f5f8fc]">
      <iframe
        title="BOSS Assessment"
        src={iframeSrc}
        className="absolute inset-0 h-full w-full border-0"
      />
      <div
        className="pointer-events-none fixed bottom-2 right-2 z-[9999] select-none font-mono text-[9px] font-medium tracking-wide text-slate-500/70"
        aria-hidden
      >
        vA
      </div>
    </div>
  );
}

export default function ScoreAPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
          <p className="text-sm text-slate-600">Loading…</p>
        </div>
      }
    >
      <ScoreAContent />
    </Suspense>
  );
}
