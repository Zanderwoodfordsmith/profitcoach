"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { useImpersonation } from "@/contexts/ImpersonationContext";
import { membershipPreviewMode } from "@/lib/membership/preview";
import { supabaseClient } from "@/lib/supabaseClient";

type MembershipSummary = {
  needsPaymentChoice: boolean;
  tierLabel: string;
};

export function MembershipPaymentBanner() {
  if (membershipPreviewMode()) return null;

  const { impersonatingCoachId } = useImpersonation();
  const [data, setData] = useState<MembershipSummary | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session?.access_token || cancelled) return;

      const headers: Record<string, string> = {
        Authorization: `Bearer ${session.access_token}`,
      };
      if (impersonatingCoachId) {
        headers["x-impersonate-coach-id"] = impersonatingCoachId;
      }

      const res = await fetch("/api/coach/membership", { headers });
      if (!res.ok || cancelled) return;
      const body = (await res.json()) as MembershipSummary;
      if (!cancelled) setData(body);
    })();
    return () => {
      cancelled = true;
    };
  }, [impersonatingCoachId]);

  if (!data?.needsPaymentChoice || dismissed) return null;

  return (
    <div
      className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
      role="status"
    >
      <p>
        <span className="font-semibold">Membership required.</span> Choose a plan to keep your
        system, tools, and community access live.
      </p>
      <div className="flex items-center gap-2">
        <Link
          href="/coach/membership"
          className="rounded-md bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-950"
        >
          View plans
        </Link>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="rounded p-1 text-amber-900 hover:bg-amber-100"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
