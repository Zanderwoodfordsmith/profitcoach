"use client";

import { useState } from "react";
import { Maximize2, MessageSquare, X } from "lucide-react";

import { AvaAction, AvaOrb, AvaRoomProvider } from "@/components/ava/AvaKit";
import type { AgentShow } from "@/lib/agent/types";
import type { BlueprintLink } from "@/lib/practiceKnowledge/blueprint";

import { AvaPanel } from "./ava/AvaPanel";
import { useSectionComments } from "./comments/SectionCommentsContext";
import { CommentsList, CommentsPanel } from "./comments/SectionCommentsUI";
import { usePractice } from "./PracticeProvider";

export type SideMode = "assistant" | "comments";

/**
 * The Blueprint's right-hand column, in two modes with a switch at the top.
 * Ava: the AI, the same Ava as everywhere else in the app, in chat bubbles.
 * Comments: people, one conversation per section, as cards.
 */
export function SidePanel({
  mode,
  sectionKey,
  page,
  canExpand = false,
  onShow,
}: {
  mode: SideMode;
  sectionKey: string | null;
  /** The Blueprint page open, so Ava starts there. */
  page: BlueprintLink | null;
  /** Wide screens: Ava can go full screen. */
  canExpand?: boolean;
  /** Ava moves the document to a page or section. */
  onShow?: (show: AgentShow) => void;
}) {
  const { setAssistantOpen } = usePractice();
  const comments = useSectionComments();
  const [stage, setStage] = useState(false);

  function closeAll() {
    setStage(false);
    comments?.close();
    setAssistantOpen(false);
  }

  const unread = comments ? Object.values(comments.threads).reduce((n, t) => n + t.unread, 0) : 0;
  const tab = (active: boolean) =>
    `inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8125rem] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#cfe6f8] ${
      active ? "bg-white text-[var(--ava-ink)] shadow-[0_1px_3px_rgba(5,30,54,0.14)]" : "text-[var(--ava-muted)] hover:text-[var(--ava-ink)]"
    }`;

  return (
    <AvaRoomProvider room="panel">
      <div className="ava-ui flex h-full min-h-0 flex-col bg-white">
        <div className="flex items-center gap-1.5 border-b border-[var(--ava-rule)] px-3 py-2.5">
          <div role="tablist" aria-label="Side panel" className="flex flex-1 rounded-full bg-[#eef3f8] p-0.5">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "assistant"}
              onClick={() => {
                comments?.close();
                setAssistantOpen(true);
              }}
              className={tab(mode === "assistant")}
            >
              <AvaOrb size={15} />
              Ava
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "comments"}
              disabled={!comments}
              onClick={comments?.openList}
              className={`${tab(mode === "comments")} disabled:opacity-40`}
            >
              <MessageSquare className="h-3.5 w-3.5" aria-hidden />
              Comments
              {unread ? (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white">
                  {unread}
                </span>
              ) : null}
            </button>
          </div>
          {canExpand && mode === "assistant" ? (
            <AvaAction iconOnly icon={<Maximize2 className="h-4 w-4" aria-hidden />} label="Full screen" onClick={() => setStage(true)} />
          ) : null}
          <AvaAction iconOnly icon={<X className="h-4 w-4" aria-hidden />} label="Close panel" onClick={closeAll} />
        </div>
        <div className="min-h-0 flex-1">
          {mode === "comments" ? (
            sectionKey ? (
              <CommentsPanel key={sectionKey} />
            ) : (
              <CommentsList page={page} />
            )
          ) : (
            <AvaPanel page={page} stage={stage} onDock={() => setStage(false)} onClose={closeAll} onShow={onShow} />
          )}
        </div>
      </div>
    </AvaRoomProvider>
  );
}
