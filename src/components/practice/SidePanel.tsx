"use client";

import dynamic from "next/dynamic";
import { MessageSquare, X } from "lucide-react";
import type { ReactNode } from "react";

import { AvaAction, AvaRoomProvider } from "@/components/ava/AvaKit";
import { AvaHalo } from "@/components/ava/AvaHalo";
import type { BlueprintLink } from "@/lib/practiceKnowledge/blueprint";
import { avaCallProtocol } from "@/lib/practiceKnowledge/intakeCall";

import { CommentsList, CommentsPanel } from "./comments/SectionCommentsUI";
import { usePractice } from "./PracticeProvider";

// The ElevenLabs voice SDK is large: fetch it only when a call starts.
const AvaVoiceCall = dynamic(() => import("./ava/AvaVoiceCall").then((m) => m.AvaVoiceCall), { ssr: false });

export type SideMode = "comments" | "call";

/**
 * The Blueprint's right-hand column: the page's chat with people (older
 * section threads show in it), or a voice call with Ava when one is started.
 * Ava herself opens from the top bar, the same Ava everywhere (4 Nov).
 */
export function SidePanel({
  mode,
  sectionKey,
  page,
  onClose,
  title,
  action = null,
  children,
}: {
  mode: SideMode;
  sectionKey: string | null;
  page: BlueprintLink | null;
  onClose: () => void;
  /** The Inbox names the chat, as it isn't beside its page (and lets you rename a chat with BCA). */
  title?: ReactNode;
  /** A button beside Close, such as the Inbox's "Open page". */
  action?: ReactNode;
  /** The Inbox's chats with BCA: same panel, their own messages. */
  children?: ReactNode;
}) {
  const { coachId, knowledge } = usePractice();
  // One chat: a page's, or the Overview's (5 Nov). Not the full document.
  const onePage = page && page.slug !== "blueprint" ? page : null;

  return (
    <AvaRoomProvider room="panel" dark={false}>
      <div className="bp-side-panel ava-ui relative flex h-full min-h-0 flex-col overflow-hidden bg-white">
        <div className="bp-side-head relative z-[1] flex h-12 shrink-0 items-center gap-2 border-b border-[var(--ava-rule)] px-4">
          {mode === "call" ? <AvaHalo size={18} /> : <MessageSquare className="h-4 w-4 text-[var(--ava-muted)]" aria-hidden />}
          <p className="min-w-0 flex-1 truncate text-[0.8125rem] font-semibold text-[var(--ava-ink)]">
            {/* One word for everyone (5 Nov): the box already says who you are writing to. */}
            {title ?? (mode === "call" ? "Call with Ava" : !onePage ? "Chats" : "Chat")}
          </p>
          {action}
          <AvaAction iconOnly icon={<X className="h-4 w-4" aria-hidden />} label="Close panel" onClick={onClose} />
        </div>
        <div className="relative z-[1] min-h-0 flex-1">
          {children ? (
            children
          ) : mode === "call" ? (
            <div className="flex h-full min-h-0 flex-col bg-white">
              <AvaVoiceCall protocol={avaCallProtocol(knowledge?.interview_completed_at)} coachId={coachId} onClose={onClose} />
            </div>
          ) : sectionKey ? (
            <CommentsPanel key={sectionKey} framed />
          ) : (
            <CommentsList page={page} />
          )}
        </div>
      </div>
    </AvaRoomProvider>
  );
}
