"use client";

import { useEffect, useState } from "react";
import { DEMO_COACH_SLUG } from "@/lib/primaryCoach";
import { demoCoachToggleUserForEmail } from "@/lib/demoCoachToggle";
import { supabaseClient } from "@/lib/supabaseClient";

type Props = {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  /** Current coach slug from the campaigns profile load. */
  coachSlug?: string | null;
};

export function CampaignDemoPreviewToggle({
  enabled,
  onChange,
  coachSlug,
}: Props) {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      if (cancelled) return;
      const staff = Boolean(demoCoachToggleUserForEmail(user?.email));
      const isZanderDemo =
        (coachSlug ?? "").trim().toLowerCase() === DEMO_COACH_SLUG;
      setAllowed(staff || isZanderDemo);
    })();
    return () => {
      cancelled = true;
    };
  }, [coachSlug]);

  if (!allowed) return null;

  return (
    <div
      className="fixed z-[80] right-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] md:bottom-6 md:right-6"
    >
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={
          enabled ? "Turn off sample campaign data" : "Show sample campaign data"
        }
        onClick={() => onChange(!enabled)}
        className={`flex items-center gap-2 rounded-full border px-3 py-2 shadow-[0_8px_28px_-10px_rgba(15,23,42,0.35)] backdrop-blur-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290]/40 focus-visible:ring-offset-2 ${
          enabled
            ? "border-amber-300/90 bg-amber-50/95 text-amber-950"
            : "border-slate-200/90 bg-white/95 text-slate-700 hover:bg-slate-50"
        }`}
      >
        <span
          className={`relative h-5 w-9 shrink-0 rounded-full transition ${
            enabled ? "bg-amber-700" : "bg-slate-200"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
              enabled ? "translate-x-4" : ""
            }`}
          />
        </span>
        <span className="text-xs font-semibold">
          {enabled ? "Sample data on" : "Sample data"}
        </span>
      </button>
    </div>
  );
}
