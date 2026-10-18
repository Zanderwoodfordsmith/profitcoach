"use client";

import { Fraunces } from "next/font/google";
import Image from "next/image";
import { useEffect, useState } from "react";
import { StartApplyPanelNative } from "@/components/booking/StartApplyPanelNative";
import {
  ADVISORY_BLUEPRINT_CALENDAR_SLUG,
  ADVISORY_BLUEPRINT_COACH_SLUG,
} from "@/config/advisoryBlueprintCalendar";
import type { ApplyPrefill } from "@/lib/booking/bookCallPrefill";
import { contactToApplyPrefill } from "@/lib/support/supportCallPrefillQuery";
import { supabaseClient } from "@/lib/supabaseClient";
import { getSessionUser } from "@/lib/supabaseAccessToken";

const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

/**
 * Public booker for Pam's Blueprint Call.
 * Prefills from the signed-in member so they go straight to a time.
 */
export function AdvisoryBlueprintPageClient() {
  const [sessionPrefill, setSessionPrefill] = useState<ApplyPrefill | undefined>();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const user = await getSessionUser();
      if (!user || cancelled) return;

      const { data: profile } = await supabaseClient
        .from("profiles")
        .select("first_name, last_name, full_name, phone")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;

      let firstName = profile?.first_name?.trim() || undefined;
      let lastName = profile?.last_name?.trim() || undefined;
      if ((!firstName || !lastName) && profile?.full_name?.trim()) {
        const parts = profile.full_name.trim().split(/\s+/);
        firstName = firstName || parts[0];
        lastName = lastName || parts.slice(1).join(" ") || undefined;
      }

      setSessionPrefill(
        contactToApplyPrefill({
          firstName,
          lastName,
          email: user.email?.trim().toLowerCase() || null,
          phone: profile?.phone?.trim() || null,
        })
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#07111c] text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 45% at 50% 18%, rgba(66,161,238,0.22) 0%, rgba(7,17,28,0) 70%)",
        }}
      />

      <div className="relative mx-auto flex w-full max-w-[920px] flex-col items-center px-4 pb-16 pt-8 sm:px-6 sm:pt-10">
        <Image
          src="/brand/profit-coach-logo-white.svg"
          alt="The Profit Coach"
          width={220}
          height={48}
          priority
          className="h-10 w-auto sm:h-11"
        />

        <header className="mt-10 max-w-2xl text-center sm:mt-12">
          <p className="flex items-center justify-center gap-3 text-[11px] font-semibold tracking-[0.22em] text-white/70 uppercase">
            <span aria-hidden className="h-px w-8 bg-white/25 sm:w-12" />
            With Pam
            <span aria-hidden className="h-px w-8 bg-white/25 sm:w-12" />
          </p>
          <h1
            className={`${fraunces.className} mt-4 text-[2.15rem] leading-[1.12] tracking-tight text-white sm:text-[2.75rem]`}
          >
            Book your
            <span className="mt-1 block italic text-[#7ec8f5]">Blueprint Call</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-slate-300 sm:text-base">
            You and Pam lock one market, one offer, one price, and one angle.
            BCA writes the rest from what you agree.
          </p>
        </header>

        <div className="mt-8 w-full sm:mt-10">
          <StartApplyPanelNative
            variant="modal"
            enableLeadCapture={false}
            intent="support"
            showNotes={false}
            title="Book your Blueprint Call"
            lead="Your name, then a time with Pam."
            slug={ADVISORY_BLUEPRINT_COACH_SLUG}
            calendarSlug={ADVISORY_BLUEPRINT_CALENDAR_SLUG}
            prefill={sessionPrefill}
          />
        </div>
      </div>
    </div>
  );
}
