"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, ChevronDown, ChevronRight, MessageSquare } from "lucide-react";

import type { ChecklistFacts } from "@/app/api/coach/practice/checklist/route";
import { GetAppModal } from "@/components/install/GetAppModal";
import { useSupportDock } from "@/components/support/SupportDock";
import { useInstallDevice } from "@/lib/installDevice";
import {
  BLUEPRINT_GROUPS,
  BLUEPRINT_PAGES,
} from "@/lib/practiceKnowledge/blueprint";
import {
  PAM_DECISION_CALL_PATH,
  practiceStepStates,
} from "@/lib/practiceKnowledge/intakeCall";
import { pageStatus } from "@/lib/practiceKnowledge/pageStatus";
import { practiceHeaders } from "@/lib/practiceKnowledge/practiceApi";

import { chatTitle } from "./BlueprintInbox";
import { useSectionComments } from "./comments/SectionCommentsContext";
import { usePractice } from "./PracticeProvider";
import { useBlueprintInbox, type InboxItem } from "./useBlueprintInbox";

type State = "done" | "todo" | "waiting";
type Step = {
  id: string;
  title: string;
  line: string;
  state: State;
  /** Where the step's button goes, or what it does. */
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
    busy?: boolean;
  };
  /** A quiet link before the button, to look before ticking it off. */
  look?: { label: string; href: string };
};
type HandStep = "linkedin_updated" | "prospects_reviewed";

const SETTINGS = "/coach/settings?tab=integrations";
const OPEN_KEY = "blueprint-checklist-open";

function useChecklistFacts(coachId: string | null, sample: boolean) {
  const [facts, setFacts] = useState<ChecklistFacts | null>(null);
  useEffect(() => {
    if (sample) return;
    let cancelled = false;
    void (async () => {
      const headers = await practiceHeaders(coachId);
      if (!headers || cancelled) return;
      const res = await fetch("/api/coach/practice/checklist", {
        headers,
      }).catch(() => null);
      const body = res?.ok
        ? ((await res.json().catch(() => null)) as ChecklistFacts | null)
        : null;
      if (!cancelled && body) setFacts(body);
    })();
    return () => {
      cancelled = true;
    };
  }, [coachId, sample]);
  return [facts, setFacts] as const;
}

/** Open unless the coach folded it away (remembered on this browser). */
function useOpen(): [boolean, () => void] {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read browser storage after hydration
      if (window.localStorage.getItem(OPEN_KEY) === "closed") setOpen(false);
    } catch {
      // Storage blocked: open.
    }
  }, []);
  return [
    open,
    () => {
      setOpen((was) => {
        try {
          window.localStorage.setItem(OPEN_KEY, was ? "closed" : "open");
        } catch {
          // Not remembered.
        }
        return !was;
      });
    },
  ];
}

function callWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * The Overview's "Get set up" (5 Nov): one list of what the coach does, from
 * connecting LinkedIn to the campaign going live. The app ticks what it can see;
 * the coach ticks the two it can't (new profile up, prospect list looks right).
 */
export function BlueprintChecklist() {
  const { knowledge, payload, href, coachId, sample, decision, coachJoinedAt } = usePractice();
  const [facts, setFacts] = useChecklistFacts(coachId, sample);
  const device = useInstallDevice();
  const [open, toggleOpen] = useOpen();
  const [getApp, setGetApp] = useState(false);
  const [saving, setSaving] = useState<HandStep | null>(null);
  if (!knowledge || !payload) return null;
  const row = { ...knowledge, payload };

  const yours = BLUEPRINT_GROUPS.filter((g) => g.yours).flatMap((g) => g.pages);
  const aboutYouDone = yours.every(
    (page) => pageStatus(page, row) !== "needs_you",
  );
  const aboutHref = yours[0]?.href ?? "/coach/blueprint";

  const callAt = payload.review.decision_call_booked_at?.value ?? null;
  const callDone =
    practiceStepStates({
      interviewCompletedAt: knowledge.interview_completed_at,
      decisionLockedAt: decision?.locked_at,
      callAt,
      joinedAt: coachJoinedAt,
      builtSections: knowledge.built_sections,
    }).pam === "done";

  const campaignsPage = BLUEPRINT_PAGES.find((p) => p.slug === "campaigns");
  const campaignStatus = campaignsPage ? pageStatus(campaignsPage, row) : null;

  const installedHere =
    device === "installed" &&
    typeof navigator !== "undefined" &&
    /iPhone|iPad|iPod|Android/.test(navigator.userAgent);

  async function tick(step: HandStep) {
    setSaving(step);
    const headers = await practiceHeaders(coachId);
    const res = headers
      ? await fetch("/api/coach/practice/checklist", {
          method: "POST",
          headers,
          body: JSON.stringify({ step }),
        }).catch(() => null)
      : null;
    const body = res?.ok
      ? ((await res.json().catch(() => null)) as { at: string | null } | null)
      : null;
    if (body && facts)
      setFacts({
        ...facts,
        [step === "linkedin_updated"
          ? "linkedin_updated_at"
          : "prospects_reviewed_at"]: body.at,
      });
    setSaving(null);
  }

  const prospects = facts?.prospects ?? 0;
  const steps: Step[] = [
    {
      id: "linkedin",
      title: "Connect LinkedIn",
      line: "So we can find your prospects and send your campaigns.",
      state: facts?.linkedin ? "done" : "todo",
      action: { label: "Connect", href: SETTINGS },
    },
    {
      id: "about",
      title: "Fill in About You",
      line: "Your story, your proof and how you sound.",
      state: aboutYouDone ? "done" : "todo",
      action: { label: "Open", href: href(aboutHref) },
    },
    {
      id: "email",
      title: "Connect your email",
      line: "Gmail or Outlook, so emails come from you.",
      state: facts?.email ? "done" : "todo",
      action: { label: "Connect", href: SETTINGS },
    },
    {
      id: "call",
      title: "Have your Blueprint Call",
      line: callDone
        ? "We agreed your market and offer."
        : callAt
          ? `Booked for ${callWhen(callAt)}.`
          : "We agree your market and offer, then build the rest.",
      state: callDone ? "done" : callAt ? "waiting" : "todo",
      action: callAt
        ? undefined
        : { label: "Book a time", href: PAM_DECISION_CALL_PATH },
    },
    {
      id: "profile",
      title: "Update your LinkedIn profile",
      line: facts?.linkedin_updated_at
        ? "Your new profile is up."
        : facts?.linkedin_draft_at
          ? "Your new profile is ready to copy across."
          : "We write it, then you put it up.",
      state: facts?.linkedin_updated_at
        ? "done"
        : facts?.linkedin_draft_at
          ? "todo"
          : "waiting",
      action:
        facts?.linkedin_draft_at && !facts.linkedin_updated_at
          ? {
              label: "I've done it",
              onClick: () => void tick("linkedin_updated"),
              busy: saving === "linkedin_updated",
            }
          : undefined,
      look:
        facts?.linkedin_draft_at && !facts.linkedin_updated_at
          ? { label: "See it", href: href("/coach/blueprint/linkedin") }
          : undefined,
    },
    {
      id: "prospects",
      title: "Review your prospects",
      line: facts?.prospects_reviewed_at
        ? `${prospects.toLocaleString("en-GB")} owners on your list.`
        : prospects
          ? `We found ${prospects.toLocaleString("en-GB")} owners for you.`
          : "We build your list of owners to contact.",
      state: facts?.prospects_reviewed_at
        ? "done"
        : prospects
          ? "todo"
          : "waiting",
      action:
        prospects && !facts?.prospects_reviewed_at
          ? {
              label: "Looks good",
              onClick: () => void tick("prospects_reviewed"),
              busy: saving === "prospects_reviewed",
            }
          : undefined,
      look:
        prospects && !facts?.prospects_reviewed_at
          ? { label: "See them", href: "/coach/prospects" }
          : undefined,
    },
    {
      id: "campaign",
      title: "Review your campaign",
      line:
        campaignStatus === "done"
          ? "You approved your campaign."
          : campaignStatus === "review"
            ? "Read the messages and approve them."
            : "We write your first campaign in your voice.",
      state:
        campaignStatus === "done"
          ? "done"
          : campaignStatus === "review"
            ? "todo"
            : "waiting",
      action:
        campaignStatus === "review" && campaignsPage
          ? { label: "Review", href: href(campaignsPage.href) }
          : undefined,
    },
    {
      id: "app",
      title: "Put the app on your phone",
      line: "Open BCA from your home screen, like any app.",
      state: facts?.phone_app || installedHere ? "done" : "todo",
      action: { label: "Show me", onClick: () => setGetApp(true) },
    },
    {
      id: "alerts",
      title: "Turn on reply alerts",
      line: "Ava tells you the moment someone replies.",
      state: facts?.alerts ? "done" : "todo",
      action: { label: "Set up", href: SETTINGS },
    },
    {
      id: "live",
      title: "Go live",
      line: facts?.campaign_live
        ? "Your campaign is sending."
        : "We switch it on once you approve it.",
      state: facts?.campaign_live ? "done" : "waiting",
    },
  ];

  const doneCount = steps.filter((s) => s.state === "done").length;
  const allDone = doneCount === steps.length;
  const next = steps.find((s) => s.state === "todo")?.id ?? null;

  return (
    <section aria-labelledby="bp-checklist" className="mt-8">
      <WaitingForYou />

      {/* Its own grey box (5 Nov), so it reads apart from the pages below. */}
      <div className="rounded-lg bg-slate-50 px-5 pb-3 pt-4 ring-1 ring-inset ring-slate-200/70">
        <div className="flex items-baseline justify-between gap-4">
          <h2
            id="bp-checklist"
            className="text-[1.0625rem] font-semibold tracking-[-0.01em] text-slate-900"
          >
            <button
              type="button"
              onClick={toggleOpen}
              aria-expanded={open}
              aria-controls="bp-checklist-steps"
              className="group inline-flex items-center gap-1.5 rounded-md hover:text-[#0c5290]"
            >
              {allDone ? "You're all set up" : "Get set up"}
              <ChevronDown
                className={`h-4 w-4 text-slate-400 transition-transform group-hover:text-[#0c5290] ${open ? "" : "-rotate-90"}`}
                aria-hidden
              />
            </button>
          </h2>
          <p className="text-sm tabular-nums text-slate-500">
            {doneCount} of {steps.length} done
          </p>
        </div>
        <div
          className="mt-2 h-1 overflow-hidden rounded-full bg-slate-200/70"
          aria-hidden
        >
          <div
            className="h-full rounded-full bg-[#1ec4b6] transition-[width]"
            style={{ width: `${(doneCount / steps.length) * 100}%` }}
          />
        </div>

        {open ? (
          <ol id="bp-checklist-steps" className="mt-2">
            {steps.map((step) => (
              <ChecklistRow key={step.id} step={step} next={step.id === next} />
            ))}
          </ol>
        ) : null}
      </div>
      <GetAppModal open={getApp} onClose={() => setGetApp(false)} />
    </section>
  );
}

/**
 * Replies waiting on the coach. One opens straight in the chat on the right;
 * several show a short list to pick from. Page chats open beside the Overview,
 * chats with BCA in Support's docked chat, so nobody leaves the Blueprint.
 */
function WaitingForYou() {
  const { href } = usePractice();
  // As the coach sees it, so BCA previewing the Overview sees the same bar.
  const { items } = useBlueprintInbox({ asCoach: true });
  const comments = useSectionComments();
  const dock = useSupportDock();
  const [picking, setPicking] = useState(false);
  if (!items.length) return null;

  function openItem(item: InboxItem) {
    setPicking(false);
    if (item.kind === "page") {
      dock?.close();
      comments?.openChat(item.page.slug);
    } else if (dock) {
      comments?.close();
      dock.open({ kind: "chat", id: item.thread.id }, href("/coach/blueprint"));
    } else {
      window.location.href = "/coach/support";
    }
  }

  const one = items.length === 1;
  return (
    <div className="mb-5 overflow-hidden rounded-lg bg-[#eef5fb] text-[#0b2a4a]">
      <button
        type="button"
        onClick={() => (one ? openItem(items[0]) : setPicking((p) => !p))}
        aria-expanded={one ? undefined : picking}
        className="flex w-full items-center gap-3 px-4 py-3 text-left text-[0.9375rem] transition-colors hover:bg-[#e3eef8]"
      >
        <MessageSquare
          className="h-[18px] w-[18px] shrink-0 text-[#0c5290]"
          aria-hidden
        />
        <span className="min-w-0 flex-1 font-semibold">
          {one
            ? `BCA is waiting on you: ${itemTitle(items[0])}`
            : `${items.length} messages from BCA are waiting for you`}
        </span>
        {one ? (
          <ChevronRight
            className="h-4 w-4 shrink-0 text-[#3d5a78]"
            aria-hidden
          />
        ) : (
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-[#3d5a78] transition-transform ${picking ? "rotate-180" : ""}`}
            aria-hidden
          />
        )}
      </button>
      {picking && !one ? (
        <ul className="border-t border-[#d6e5f2] px-2 py-1.5">
          {items.map((item) => (
            <li key={item.key}>
              <button
                type="button"
                onClick={() => openItem(item)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[0.9375rem] hover:bg-white/70"
              >
                <span className="min-w-0 flex-1 truncate">
                  {itemTitle(item)}
                </span>
                {item.unread ? (
                  <span className="inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white">
                    {item.unread}
                  </span>
                ) : null}
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-[#3d5a78]"
                  aria-hidden
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function itemTitle(item: InboxItem): string {
  return item.kind === "page" ? item.page.title : chatTitle(item.thread);
}

/**
 * Three looks (5 Nov), on hairlines inside the grey box: done has the teal
 * tick, ready to do is dark text with its button, not yet is lighter text.
 * The next one to do gets the filled button.
 */
function ChecklistRow({ step, next }: { step: Step; next: boolean }) {
  const done = step.state === "done";
  const waiting = step.state === "waiting";
  const action = step.action && !done ? step.action : null;
  const buttonClass = next
    ? "bg-[#0c5290] text-white hover:bg-[#0a4577]"
    : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-900";
  return (
    <li className="flex items-center gap-3 border-t border-slate-200/80 py-3 first:border-t-0">
      <span
        aria-hidden
        className={`mt-px flex h-[22px] w-[22px] shrink-0 items-center justify-center self-start rounded-full ${
          done
            ? "bg-[#1ec4b6] text-white"
            : waiting
              ? "border-2 border-slate-300"
              : "border-2 border-slate-400"
        }`}
      >
        {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block text-[0.9375rem] font-semibold leading-6 ${done ? "text-slate-500" : waiting ? "text-slate-400" : "text-slate-900"}`}
        >
          {step.title}
          <span className="sr-only">
            {done ? " (done)" : waiting ? " (not yet)" : ""}
          </span>
        </span>
        <span
          className={`block text-[0.9375rem] leading-6 ${waiting ? "text-slate-400" : "text-slate-500"}`}
        >
          {step.line}
        </span>
      </span>
      {step.look && !done ? (
        <Link
          href={step.look.href}
          className="shrink-0 text-sm font-medium text-[#0c5290] hover:underline"
        >
          {step.look.label}
        </Link>
      ) : null}
      {action ? (
        action.href ? (
          <Link
            href={action.href}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${buttonClass}`}
          >
            {action.label}
          </Link>
        ) : (
          <button
            type="button"
            onClick={action.onClick}
            disabled={action.busy}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors disabled:opacity-60 ${buttonClass}`}
          >
            {action.busy ? "Saving…" : action.label}
          </button>
        )
      ) : null}
    </li>
  );
}
