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

const VA_COACH_LABEL_MAX = 80;
const VA_COACH_STORAGE_KEY = "pc_boss_va_coach";

async function coachLabelForBadge(slug: string): Promise<string> {
  const fallback = slug.trim() || "BCA";
  try {
    const res = await fetch(`/api/coach-by-slug?slug=${encodeURIComponent(slug)}`);
    if (!res.ok) return fallback;
    const j = (await res.json()) as {
      full_name?: string | null;
      coach_business_name?: string | null;
    };
    const raw =
      (j.full_name && String(j.full_name).trim()) ||
      (j.coach_business_name && String(j.coach_business_name).trim()) ||
      fallback;
    if (raw.length <= VA_COACH_LABEL_MAX) return raw;
    return `${raw.slice(0, VA_COACH_LABEL_MAX - 1)}…`;
  } catch {
    return fallback;
  }
}

function ScoreAContent() {
  const searchParams = useSearchParams();
  const viewTracked = useRef(false);

  useEffect(() => {
    if (viewTracked.current) return;
    viewTracked.current = true;
    let cancelled = false;
    const coachSlug = searchParams.get("coach")?.trim() || "BCA";
    const sessionId = getOrSetSessionId();

    async function go() {
      const [coachLabel] = await Promise.all([
        coachLabelForBadge(coachSlug),
        fetch("/api/landing/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            variant: "a",
            coach_slug: coachSlug || null,
            event_type: "view",
            session_id: sessionId,
          }),
        }).catch(() => {}),
      ]);

      const sp = new URLSearchParams(searchParams.toString());
      sp.set("va", "1");
      if (coachLabel) sp.set("va_coach", coachLabel);

      if (!cancelled && typeof window !== "undefined") {
        try {
          sessionStorage.setItem(VA_COACH_STORAGE_KEY, coachLabel);
        } catch {
          /* private mode / quota */
        }
        window.location.replace(`/boss-exact/boss-assessment.html?${sp.toString()}`);
      }
    }
    void go();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f8fc] px-4">
      <p className="text-sm text-slate-600">Loading assessment…</p>
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
