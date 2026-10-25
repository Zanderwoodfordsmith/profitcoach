"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Phone } from "lucide-react";

import { useAgentConversation, type AgentChatSummary } from "@/components/agent/useAgentConversation";
import { AvaChat, type AvaStarterSpec } from "@/components/ava/AvaChat";
import { AvaAction, AvaBubble } from "@/components/ava/AvaKit";
import { AvaHalo } from "@/components/ava/AvaHalo";
import { AvaStage } from "@/components/ava/AvaStage";
import type { AgentShow } from "@/lib/agent/types";
import {
  BLUEPRINT_SECTIONS,
  fieldFilled,
  fieldValue,
  type BlueprintLink,
} from "@/lib/practiceKnowledge/blueprint";
import type { PracticeKnowledgePayload } from "@/lib/practiceKnowledge/types";

import { avaCallIntro, avaCallProtocol } from "@/lib/practiceKnowledge/intakeCall";
import { primeCallAudio } from "./callAudio";

import { usePractice } from "../PracticeProvider";

// The ElevenLabs voice SDK is large: fetch it only when a call starts.
const AvaVoiceCall = dynamic(() => import("./AvaVoiceCall").then((m) => m.AvaVoiceCall), { ssr: false });

/**
 * Ava in the Blueprint: one conversation at a time, titled by Ava, with every
 * earlier one in History. She starts from the page you are on, saves your
 * answers as you give them, and proposes new copy for you to accept. Built
 * from the same parts as Ava everywhere else in the app.
 */

type InterviewSession = {
  id: string;
  status: string;
  started_at: string;
  turns: { role: "user" | "assistant"; content: string }[];
};

/** Answers still open on one page (or the whole Blueprint), leaving out what is set on the page itself. */
function openAnswers(payload: PracticeKnowledgePayload, pageSlug?: string): number {
  let open = 0;
  for (const ref of BLUEPRINT_SECTIONS) {
    if (ref.section.source === "we_build" || ref.section.face === "stored") continue;
    if (pageSlug && ref.page.slug !== pageSlug) continue;
    for (const field of ref.section.fields ?? []) {
      if (field.widget) continue;
      if (field.showIf) {
        const gate = fieldValue(payload, field.showIf.path)?.value;
        if (!field.showIf.in.includes(String(gate ?? ""))) continue;
      }
      if (!fieldFilled(payload, field)) open += 1;
    }
  }
  return open;
}

async function fetchHistory(
  authHeaders: () => Promise<Record<string, string> | null>,
  coachId: string | null
): Promise<{ chats: AgentChatSummary[]; interviews: InterviewSession[] } | null> {
  const headers = await authHeaders();
  if (!headers) return null;
  const [chatRes, interviewRes] = await Promise.all([
    fetch(coachId ? `/api/agent/chats?coach=${coachId}` : "/api/agent/chats", { headers }).catch(() => null),
    fetch("/api/coach/practice/interview/history", { headers }).catch(() => null),
  ]);
  const chatBody = chatRes?.ok ? ((await chatRes.json().catch(() => null)) as { chats?: AgentChatSummary[] } | null) : null;
  const interviewBody = interviewRes?.ok
    ? ((await interviewRes.json().catch(() => null)) as { sessions?: InterviewSession[] } | null)
    : null;
  return { chats: chatBody?.chats ?? [], interviews: interviewBody?.sessions ?? [] };
}

function interviewDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
}

export function AvaPanel({
  page,
  stage = false,
  onDock,
  onClose,
  onShow,
}: {
  page: BlueprintLink | null;
  /** Full screen. The conversation carries over, because this panel stays mounted. */
  stage?: boolean;
  onDock?: () => void;
  onClose?: () => void;
  /** Move the document beside her. Full screen docks first, so the page is in view. */
  onShow?: (show: AgentShow) => void;
}) {
  const { authHeaders, coachId, coachName, viewer, payload, knowledge, reload, transcribe, sample, callNonce } = usePractice();
  const defaultCoach = useMemo(() => (coachId ? { id: coachId, name: coachName } : null), [coachId, coachName]);
  const convo = useAgentConversation({
    authHeaders,
    screenPath: page ? `/coach/blueprint/${page.slug}` : "/coach/blueprint",
    defaultCoach,
    onWrote: reload,
    onShow: onShow
      ? (show) => {
          if (stage) onDock?.();
          onShow(show);
        }
      : undefined,
  });
  const [calling, setCalling] = useState(false);
  const [interview, setInterview] = useState<InterviewSession | null>(null);
  const [draft, setDraft] = useState("");
  const [chats, setChats] = useState<AgentChatSummary[] | null>(null);
  const [interviews, setInterviews] = useState<InterviewSession[] | null>(null);

  const [seenCall, setSeenCall] = useState(0);
  if (callNonce && callNonce !== seenCall) {
    setSeenCall(callNonce);
    setCalling(true);
  }

  const first = coachName.split(/\s+/)[0] || "";
  const protocol = avaCallProtocol(knowledge?.interview_completed_at);
  const callIntro = avaCallIntro(protocol);
  const onPage = payload && page ? openAnswers(payload, page.slug) : 0;
  const everywhere = payload ? openAnswers(payload) : 0;

  // History: Ava's chats (for admins, every chat about this coach) and the earlier conversations.
  // Fetched again whenever a conversation starts or changes, so new titles show.
  useEffect(() => {
    if (sample) return;
    let live = true;
    void fetchHistory(authHeaders, viewer === "bca" ? coachId : null).then((found) => {
      if (!live || !found) return;
      setChats(found.chats);
      setInterviews(found.interviews);
    });
    return () => {
      live = false;
    };
  }, [authHeaders, coachId, viewer, sample, convo.chatId, convo.title]);

  // The call runs beside the document, so full screen docks first.
  function startCall() {
    primeCallAudio();
    if (stage) onDock?.();
    setCalling(true);
  }

  if (sample) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-8 text-center">
        <AvaHalo size={44} dark />
        <p className="mt-4 text-sm leading-6 text-[var(--ava-muted)]">Choose a coach to work with Ava. Nothing saves in the empty preview.</p>
      </div>
    );
  }

  if (calling && !stage) {
    return (
      // The call view is drawn for a light background, so it keeps one inside her blue panel.
      <div className="flex h-full min-h-0 flex-col bg-white">
        <AvaVoiceCall protocol={protocol} coachId={coachId} onClose={() => setCalling(false)} />
      </div>
    );
  }

  const send = (text: string) => void convo.send(text);
  const count = (n: number, primary: boolean): ReactNode => (
    <span className={primary ? "opacity-70" : "text-[var(--ava-faint)]"}> · {n} open</span>
  );
  const starters: AvaStarterSpec[] = [];
  if (protocol === "intake") starters.push({ key: "call", label: "Start the call with Ava", primary: true, onPick: startCall });
  if (onPage && page) {
    const primary = protocol !== "intake";
    starters.push({
      key: "page-gaps",
      primary,
      label: (
        <>
          Fill the gaps on {page.title}
          {count(onPage, primary)}
        </>
      ),
      onPick: () => send(`Let's fill the gaps on the ${page.title} page.`),
    });
  } else if (everywhere) {
    const primary = protocol !== "intake";
    starters.push({
      key: "all-gaps",
      primary,
      label: (
        <>
          Keep filling in my blueprint
          {count(everywhere, primary)}
        </>
      ),
      onPick: () => send("Let's keep filling in my blueprint."),
    });
  }
  if (page?.slug === "content") {
    starters.push({
      key: "newsletter",
      label: "Write this week's newsletter",
      primary: !onPage && !everywhere,
      onPick: () => send("Write this week's LinkedIn newsletter for my avatar."),
    });
  }
  // Once the answers are in, Ava takes them through it on the page.
  if (payload && !everywhere) {
    starters.push({
      key: "check-all",
      label: "Look over my blueprint with me",
      primary: page?.slug !== "content",
      onPick: () => send("Let's go through my blueprint together and check it's right."),
    });
  }
  if (page) {
    starters.push({
      key: "check",
      label: `Look over ${page.title} with me`,
      onPick: () => send(`Let's look over my ${page.title} page together.`),
    });
  }

  const earlier = interviews?.length ? (
    <div>
      <p className="mb-1.5 pl-3 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[var(--ava-faint)]">
        Earlier, from Talk it through
      </p>
      <ul className="space-y-1">
        {interviews.map((session) => {
          const answers = session.turns.filter((t) => t.role === "user").length;
          return (
            <li key={session.id}>
              <button
                type="button"
                onClick={() => setInterview(session)}
                className="flex w-full items-baseline justify-between gap-3 rounded-xl px-3 py-2 text-left hover:bg-[var(--ava-tint)]"
              >
                <span className="text-sm text-[var(--ava-ink)]">{interviewDate(session.started_at)}</span>
                <span className="text-xs text-[var(--ava-faint)]">
                  {answers} {answers === 1 ? "answer" : "answers"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  ) : null;

  const chat = (headerSlot: HTMLElement | null) => (
    <AvaChat
      convo={convo}
      transcribe={transcribe}
      chats={chats}
      greeting={viewer === "bca" ? `Working on ${coachName || "this coach"}'s blueprint` : `Hi${first ? ` ${first}` : ""}, I'm Ava`}
      intro={
        protocol === "intake"
          ? callIntro.detail
          : "I help you finish and sharpen your blueprint. The facts come from you; I help you say them well, and I can rewrite the copy BCA wrote."
      }
      starters={starters}
      footnote="Or ask me anything below."
      actions={<AvaAction icon={<Phone className={stage ? "h-4 w-4" : "h-3.5 w-3.5"} aria-hidden />} label="Call" onClick={startCall} />}
      historyExtra={earlier}
      detail={
        interview
          ? {
              title: "Earlier conversation",
              onBack: () => setInterview(null),
              body: (
                <div className="space-y-3">
                  <p className="text-xs text-[var(--ava-faint)]">
                    From &ldquo;Talk it through&rdquo;, {interviewDate(interview.started_at)}. Everything you answered is already in your
                    blueprint.
                  </p>
                  {interview.turns.map((turn, i) => (
                    <AvaBubble key={i} role={turn.role}>
                      {turn.content}
                    </AvaBubble>
                  ))}
                </div>
              ),
            }
          : null
      }
      coachFirst={first}
      readOnlyNote={`${first ? `${first}'s` : "The coach's"} conversation. You can read it, not reply.`}
      placeholder="Ask Ava, or answer in your own words"
      draft={draft}
      setDraft={setDraft}
      headerSlot={headerSlot}
      onNew={() => setInterview(null)}
      onNavigate={stage ? onDock : undefined}
    />
  );

  if (stage && onDock && onClose) {
    return (
      <AvaStage subtitle={page ? `Blueprint · ${page.title}` : "Blueprint"} onDock={onDock} onClose={onClose}>
        {(slot) => chat(slot)}
      </AvaStage>
    );
  }
  return chat(null);
}
