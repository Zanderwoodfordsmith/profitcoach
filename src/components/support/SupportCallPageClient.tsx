"use client";

import { Fraunces } from "next/font/google";
import { Settings } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { StartApplyPanelNative } from "@/components/booking/StartApplyPanelNative";
import type { ApplyPrefill } from "@/lib/booking/bookCallPrefill";
import { contactToApplyPrefill } from "@/lib/support/supportCallPrefill";
import {
  SUPPORT_CALL_CALENDAR_SLUG,
  supportCallHostDisplayName,
  type SupportCallHostSlug,
} from "@/lib/support/supportCallHosts";
import { supabaseClient } from "@/lib/supabaseClient";

const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

type Props = {
  hostSlug: SupportCallHostSlug;
};

/**
 * Public support-call booker for a single host.
 * Prefills from URL query (email links) and, when signed in, from the member profile.
 */
export function SupportCallPageClient({ hostSlug }: Props) {
  const [sessionPrefill, setSessionPrefill] = useState<ApplyPrefill | undefined>();
  const [isAdmin, setIsAdmin] = useState(false);
  const hostName = supportCallHostDisplayName(hostSlug);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      if (!user || cancelled) return;

      const { data: profile } = await supabaseClient
        .from("profiles")
        .select("first_name, last_name, full_name, phone, role")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;
      setIsAdmin(profile?.role === "admin");

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
            The Profit Coach
            <span aria-hidden className="h-px w-8 bg-white/25 sm:w-12" />
          </p>
          <h1
            className={`${fraunces.className} mt-4 text-[2.15rem] leading-[1.12] tracking-tight text-white sm:text-[2.75rem]`}
          >
            Book your 1-1
            <span className="mt-1 block italic text-[#7ec8f5]">
              20-Minute Support Call
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-slate-300 sm:text-base">
            A short, no-pressure chat with {hostName} about whatever you need
            help with — the platform, your practice, or a question that&apos;s
            been sitting with you.
          </p>
        </header>

        <div className="mt-8 w-full sm:mt-10">
          <StartApplyPanelNative
            variant="modal"
            enableLeadCapture={false}
            intent="support"
            slug={hostSlug}
            calendarSlug={SUPPORT_CALL_CALENDAR_SLUG}
            prefill={sessionPrefill}
          />
        </div>
      </div>

      {isAdmin ? (
        <Link
          href="/admin/support?tab=settings"
          aria-label="Support call calendar settings"
          title="Support call settings"
          className="fixed bottom-4 right-4 z-20 rounded-full p-2 text-white/25 transition-colors hover:bg-white/10 hover:text-white/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40"
        >
          <Settings className="h-4 w-4" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}
