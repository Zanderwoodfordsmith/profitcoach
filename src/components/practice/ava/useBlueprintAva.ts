"use client";

import { useEffect, useMemo, useRef } from "react";

import { setAvaPageContext, setAvaPageHandlers, type AvaPageStarter } from "@/components/ava/avaPageLink";
import { avaWorkFor, pageScope } from "@/lib/launch/avaWork";
import type { AgentShow } from "@/lib/agent/types";
import { BLUEPRINT_SECTIONS, fieldFilled, fieldValue, type BlueprintLink } from "@/lib/practiceKnowledge/blueprint";
import { avaCallProtocol } from "@/lib/practiceKnowledge/intakeCall";
import type { PracticeKnowledgePayload } from "@/lib/practiceKnowledge/types";

import { usePractice } from "../PracticeProvider";

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

/**
 * The Blueprint tells the top-bar Ava where she is (4 Nov: one Ava,
 * everywhere): the page, whose Blueprint, the buttons on a new chat, and how
 * to reload or move the document when she writes or shows a section. BCA on
 * one page also gets the slot for waiting work.
 */
export function useBlueprintAva({
  page,
  onePage,
  isAdmin,
  onShow,
}: {
  page: BlueprintLink | null;
  /** One page, not the overview or the full document. */
  onePage: boolean;
  isAdmin: boolean;
  onShow: (show: AgentShow) => void;
}) {
  const { coachId, coachName, viewer, payload, knowledge, reload, sample, openAvaCall } = usePractice();
  const ready = Boolean(payload && knowledge && !sample);

  // The latest functions, read when used, so a new function each render never re-registers.
  const latest = useRef({ reload, onShow, openAvaCall });
  useEffect(() => {
    latest.current = { reload, onShow, openAvaCall };
  });

  const bca = viewer === "bca";
  const first = coachName.trim().split(/\s+/)[0] || "";
  const protocol = avaCallProtocol(knowledge?.interview_completed_at);
  const onPage = payload && page && onePage ? openAnswers(payload, page.slug) : 0;
  const everywhere = payload ? openAnswers(payload) : 0;
  const toWrite =
    bca && isAdmin && page && onePage && knowledge && payload ? avaWorkFor(pageScope(page.slug), { ...knowledge, payload }).toWrite.length : 0;

  const context = useMemo(() => {
    if (!ready) return null;
    // BCA looking: the buttons speak about the coach, not as them.
    const whose = bca ? `${first || "the coach"}'s` : "my";
    const starters: AvaPageStarter[] = [];
    if (bca && isAdmin && page && onePage && (toWrite || page.slug === "linkedin")) {
      starters.push({ key: "bca-write", primary: true, label: `Write ${page.title} for ${first || "this coach"}`, prompt: `Write the ${page.title} page for ${first || "this coach"}.` });
    }
    if (protocol === "intake") {
      starters.push({ key: "call", label: "Start the call with Ava", primary: true, call: true });
    }
    if (onPage && page) {
      starters.push({
        key: "page-gaps",
        primary: protocol !== "intake" && !starters.length,
        label: `Fill the gaps on ${page.title} · ${onPage} open`,
        prompt: `Let's fill the gaps on the ${page.title} page.`,
      });
    } else if (everywhere) {
      starters.push({
        key: "all-gaps",
        primary: protocol !== "intake",
        label: `Keep filling in ${whose} blueprint · ${everywhere} open`,
        prompt: `Let's keep filling in ${whose} blueprint.`,
      });
    }
    if (page?.slug === "content") {
      starters.push({ key: "newsletter", label: "Write this week's newsletter", prompt: `Write this week's LinkedIn newsletter for ${whose} avatar.` });
    }
    if (!everywhere) {
      starters.push({ key: "check-all", label: `Look over ${whose} blueprint with me`, prompt: `Let's go through ${whose} blueprint together and check it's right.` });
    }
    if (page && onePage) {
      starters.push({ key: "check", label: `Look over ${page.title} with me`, prompt: `Let's look over ${whose} ${page.title} page together.` });
    }
    return {
      screenPath: page ? `/coach/blueprint/${page.slug}` : "/coach/blueprint",
      coach: coachId ? { id: coachId, name: coachName } : null,
      bcaWork: Boolean(bca && isAdmin && page && onePage),
      starters,
      greeting: bca ? `Working on ${coachName || "this coach"}'s blueprint` : `Hi${first ? ` ${first}` : ""}, I'm Ava`,
      intro: bca
        ? `I write and check ${whose} blueprint with you. Nothing reaches ${first || "them"} until you press Save or Send.`
        : "I help you finish and sharpen your blueprint. The facts come from you; I help you say them well, and I can rewrite the copy BCA wrote.",
    };
  }, [ready, bca, isAdmin, first, page, onePage, toWrite, protocol, onPage, everywhere, coachId, coachName]);

  useEffect(() => {
    setAvaPageContext(context);
  }, [context]);
  useEffect(() => {
    setAvaPageHandlers({
      onWrote: () => latest.current.reload(),
      onShow: (show) => latest.current.onShow(show),
      onCall: () => latest.current.openAvaCall(),
    });
    return () => {
      setAvaPageContext(null);
      setAvaPageHandlers({});
    };
  }, []);
}
