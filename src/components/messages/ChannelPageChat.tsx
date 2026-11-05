"use client";

import "@/components/practice/document/blueprint.css";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ChevronLeft, ExternalLink } from "lucide-react";

import { useSectionComments } from "@/components/practice/comments/SectionCommentsContext";
import { CommentsPanel } from "@/components/practice/comments/SectionCommentsUI";
import { PracticeProvider } from "@/components/practice/PracticeProvider";
import { blueprintPage } from "@/lib/practiceKnowledge/blueprint";
import { adminPageHref } from "@/lib/practiceKnowledge/blueprintGrid";

/**
 * A coach's Blueprint page chat, opened from their channel in Support (job 26).
 * It is the same chat the coach sees beside that page, not a copy, so a reply
 * here lands on the page.
 */
export function ChannelPageChat({
  coachId,
  slug,
  channelLabel,
  onBack,
  className = "",
}: {
  coachId: string;
  slug: string;
  channelLabel: string;
  onBack: () => void;
  className?: string;
}) {
  return (
    <section className={`flex min-h-0 min-w-0 flex-col overflow-hidden bg-white ${className}`}>
      <PracticeProvider coachId={coachId}>
        <PageChat coachId={coachId} slug={slug} channelLabel={channelLabel} onBack={onBack} />
      </PracticeProvider>
    </section>
  );
}

function PageChat({ coachId, slug, channelLabel, onBack }: { coachId: string; slug: string; channelLabel: string; onBack: () => void }) {
  const comments = useSectionComments();
  const openChat = comments?.openChat;
  useEffect(() => {
    openChat?.(slug);
    // Open once per page; openChat changes whenever the comments do.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, Boolean(openChat)]);

  // Leaving marks the chat read, as closing it on the page does.
  const back = () => {
    comments?.close();
    onBack();
  };
  // The panel's own close button leaves the chat too.
  const open = Boolean(comments?.panelOpen);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) wasOpen.current = true;
    else if (wasOpen.current) onBack();
  }, [open, onBack]);

  return (
    <>
      <header className="flex min-h-12 shrink-0 items-center gap-x-2 border-b border-slate-200 px-3 py-1.5">
        <button
          type="button"
          onClick={back}
          className="inline-flex min-w-0 shrink items-center gap-1 rounded-md px-1.5 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        >
          <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
          <span className="truncate">{channelLabel}</span>
        </button>
        <span className="select-none text-slate-300" aria-hidden>
          /
        </span>
        <span className="min-w-0 truncate text-sm font-semibold text-slate-900">{blueprintPage(slug)?.title ?? slug}</span>
        <Link
          href={adminPageHref(slug, coachId)}
          className="ml-auto inline-flex shrink-0 items-center gap-1 text-xs font-medium text-sky-700 hover:underline"
        >
          Open page
          <ExternalLink className="h-3 w-3" aria-hidden />
        </Link>
      </header>
      <div className="bp-doc min-h-0 flex-1">
        <CommentsPanel />
      </div>
    </>
  );
}
