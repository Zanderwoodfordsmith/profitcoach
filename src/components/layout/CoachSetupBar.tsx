"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, UserRound, X } from "lucide-react";

import { LinkedInSolidIcon } from "@/components/icons/LinkedInSolidIcon";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";

import type { PageTourStep } from "./pageTours";
import { startCustomTour } from "./SectionTour";

/** Zander's referral link: two months of Sales Navigator free (20 Nov). */
const SALES_NAV_REFERRAL_URL =
  "https://www.linkedin.com/premium/redeem/?upsellOrderOrigin=sn_referral_promotion&coupon=rbt8JKG-x&customKey=ref_s&redeemTypeV2=REFERRAL_COUPON";

const ABOUT_YOU_HREF = "/coach/blueprint/about";

type LinkedInState = "ok" | "connect" | "reconnect" | "sales_navigator";
type OpenQuestion = { path: string; sectionKey: string; section: string; ask: string };
type AboutYou = { state: "not_started" | "started" | "done"; left: number; open?: OpenQuestion[] };
type Need = "about_start" | "about_finish" | "connect" | "reconnect" | "sales_navigator";

/**
 * One thing at a time, the biggest blocker first: About You not started, then
 * LinkedIn not connected, then About You not finished, then Sales Navigator.
 */
function pickNeed(aboutYou: AboutYou, linkedin: LinkedInState): Need | null {
  if (aboutYou.state === "not_started") return "about_start";
  if (linkedin === "connect" || linkedin === "reconnect") return linkedin;
  if (aboutYou.state === "started") return "about_finish";
  if (linkedin === "sales_navigator") return "sales_navigator";
  return null;
}

function copyFor(need: Need, left: number): { text: string; button: string } {
  switch (need) {
    case "about_start":
      return {
        text: "Fill in About You and we write your LinkedIn profile and campaigns for you. It's a few minutes of ticking and tapping.",
        button: "Start About You",
      };
    case "about_finish":
      return {
        text: `You're nearly there. ${left === 1 ? "One question is" : `${left} questions are`} left in About You, then we write the rest for you.`,
        button: "Finish About You",
      };
    case "connect":
      return {
        text: "Connect your LinkedIn so we can find your best-fit owners and start your campaigns.",
        button: "Connect LinkedIn",
      };
    case "reconnect":
      return {
        text: "Your LinkedIn has disconnected. Reconnect it to keep your campaigns running.",
        button: "Reconnect LinkedIn",
      };
    case "sales_navigator":
      return {
        text: "We build your prospect lists in LinkedIn Sales Navigator. Get 2 months free with our link.",
        button: "Get 2 months free",
      };
  }
}

/** One guide step per question left: the card sits by its box and asks it in plain words. */
function questionSteps(open: OpenQuestion[]): PageTourStep[] {
  return open.map((q, i) => ({
    selector: `.bp-field:has([id="f-${q.path}"])`,
    // Boxes that aren't plain fields (or a folded section): point at the whole section.
    fallback: `[id="s-${q.sectionKey.replace(":", "-")}"]`,
    title: q.section,
    body: i === open.length - 1 ? `${q.ask} Your answer saves by itself when you click away.` : q.ask,
  }));
}

const hiddenKey = (coachId: string | null, need: Need) => `pc-setup-bar-hidden:${coachId ?? "self"}:${need}`;

/**
 * Top of the coach app until the coach has done their part of the launch.
 * Closing it hides that message for this visit only. Admins see it for the
 * coach they're viewing as.
 */
export function CoachSetupBar({
  coachId,
  bleedInset,
  flushBelow,
}: {
  coachId: string | null;
  /** Same edge-to-edge classes as the title bar below it. */
  bleedInset: string;
  /** Cancel the page column's gap so the title bar sits right under the strip. */
  flushBelow: boolean;
}) {
  const [need, setNeed] = useState<Need | null>(null);
  const [left, setLeft] = useState(0);
  const [open, setOpen] = useState<OpenQuestion[]>([]);
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);

  const check = useCallback(async () => {
    const headers = await getCoachAuthHeaders(coachId);
    if (!headers) return;
    const res = await fetch("/api/coach/setup-status", { headers }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { aboutYou?: AboutYou; linkedin?: LinkedInState } | null;
    if (!body?.aboutYou || !body.linkedin) return;
    const next = pickNeed(body.aboutYou, body.linkedin);
    setNeed(next);
    setLeft(body.aboutYou.left);
    setOpen(body.aboutYou.open ?? []);
    try {
      setHidden(next ? sessionStorage.getItem(hiddenKey(coachId, next)) === "1" : false);
    } catch {
      setHidden(false);
    }
  }, [coachId]);

  useEffect(() => {
    void check();
  }, [check]);

  if (!need || hidden) return null;
  const copy = copyFor(need, left);
  const aboutYou = need === "about_start" || need === "about_finish";

  async function connect() {
    setError(null);
    setBusy(true);
    try {
      const headers = await getCoachAuthHeaders(coachId);
      if (!headers) throw new Error("Please sign in again.");
      const res = await fetch("/api/coach/integrations/accounts", {
        method: "POST",
        headers,
        body: JSON.stringify({ provider: "LINKEDIN", returnTo: "settings" }),
      });
      const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !body.url) throw new Error(body.error || "Could not start connecting.");
      window.location.href = body.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start connecting.");
      setBusy(false);
    }
  }

  function close() {
    setHidden(true);
    try {
      if (need) sessionStorage.setItem(hiddenKey(coachId, need), "1");
    } catch {
      // Private window: it just comes back next page load.
    }
  }

  const primary =
    "inline-flex shrink-0 items-center gap-1.5 rounded-md bg-white px-3 py-1 font-medium text-sky-700 hover:bg-sky-50 disabled:opacity-60";

  return (
    <div className={`relative flex shrink-0 items-center gap-3 border-b border-sky-700 bg-sky-600 py-1.5 text-sm text-white max-md:flex-wrap max-md:items-start max-md:gap-y-2.5 max-md:py-3 md:justify-center ${bleedInset} ${flushBelow ? "-mb-4" : ""}`}>
      {/* Desktop: icon, text and button sit together in the middle; X stays at the right edge. */}
      <div className="max-md:contents md:flex md:min-w-0 md:items-center md:gap-3 md:px-8">
      {aboutYou ? (
        <UserRound className="h-4 w-4 shrink-0 text-white max-md:mt-0.5" aria-hidden />
      ) : (
        <LinkedInSolidIcon className="h-4 w-4 ring-1 ring-white/80 max-md:mt-0.5" />
      )}
      <p className="min-w-0 max-md:flex-1 max-md:basis-[calc(100%-1.75rem)] max-md:pr-7">
        {error ?? (opened ? "Once Sales Navigator is on your LinkedIn, check again here." : copy.text)}
      </p>
      <div className="flex shrink-0 items-center gap-3 max-md:basis-full max-md:pl-7">
      {opened ? (
        <button
          type="button"
          onClick={() => {
            setOpened(false);
            void check();
          }}
          className="shrink-0 rounded-md border border-white/70 px-3 py-1 font-medium text-white hover:bg-white/10"
        >
          Check again
        </button>
      ) : null}
      {aboutYou ? (
        <Link
          href={ABOUT_YOU_HREF}
          className={primary}
          // Nearly done: walk them to each question left, like the page tours.
          onClick={need === "about_finish" ? () => startCustomTour("About You", questionSteps(open)) : undefined}
        >
          {copy.button}
        </Link>
      ) : need === "sales_navigator" ? (
        <button
          type="button"
          onClick={() => {
            window.open(SALES_NAV_REFERRAL_URL, "_blank", "noopener,noreferrer");
            setOpened(true);
          }}
          className={primary}
        >
          {copy.button}
        </button>
      ) : (
        <button type="button" onClick={() => void connect()} disabled={busy} className={primary}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {copy.button}
        </button>
      )}
      </div>
      </div>
      <button
        type="button"
        onClick={close}
        aria-label="Hide for now"
        className="shrink-0 rounded-md p-1 text-white/80 hover:bg-white/15 hover:text-white absolute right-2 md:top-1/2 md:-translate-y-1/2 max-md:top-2"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
