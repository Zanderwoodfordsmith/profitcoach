"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Lock } from "lucide-react";

import { useAvaTurns, useAvaWorkSlot } from "@/components/ava/avaPageLink";
import { ActivityTab, useAvaOpen } from "@/components/jobs/JobActivity";
import { avaWorkFor, pageScope } from "@/lib/launch/avaWork";
import type { AgentShow } from "@/lib/agent/types";
import { sectionByKey, type BlueprintLink } from "@/lib/practiceKnowledge/blueprint";

import { usePractice } from "./PracticeProvider";

/**
 * BCA's waiting work on one Blueprint page, pinned at the top of Ava's panel
 * (4 Nov: one Ava, opened from the top bar). One line folded; open it to
 * check her draft and save it into the Blueprint, send her message into the
 * page's chat, or run her on the page's parts. Drawn into Ava's panel with a
 * portal, so it keeps the Blueprint's data. Coaches never see it.
 */
export function PageActivity({ page, onShow }: { page: BlueprintLink; onShow?: (show: AgentShow) => void }) {
  const slot = useAvaWorkSlot();
  const turns = useAvaTurns();
  const { knowledge, payload, coachName, reload } = usePractice();
  const [open, setOpen] = useState(false);
  // Saving or sending changes the count too, not only Ava's turns.
  const [saves, setSaves] = useState(0);
  const scopeKey = pageScope(page.slug);
  const waitingByPage = useAvaOpen(knowledge?.coach_id ?? null, Boolean(slot && knowledge), turns + saves);
  if (!slot || !knowledge || !payload) return null;

  const ava = avaWorkFor(scopeKey, { ...knowledge, payload });
  // Ava's greeting doesn't say whose Blueprint she's on, so the strip does.
  const coachFirst = coachName.trim().split(/\s+/)[0] || "";
  const waiting = waitingByPage[scopeKey] ?? 0;
  const summary = waiting
    ? `${waiting} to check`
    : ava.ready
      ? "Ava ready to write"
      : ava.missing.length
        ? `${ava.missing.length} missing`
        : "nothing waiting";

  return createPortal(
    <div className="rounded-2xl bg-white/[0.08] ring-1 ring-inset ring-white/15">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title="Only BCA sees this. Nothing reaches the coach until you save or send it."
        className="flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left text-sm text-[var(--ava-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ava-ring)]"
      >
        <Lock className="h-3.5 w-3.5 shrink-0 text-[var(--ava-muted)]" aria-hidden />
        <span className="min-w-0 flex-1 truncate">
          <span className="font-semibold">
            {coachFirst ? `${coachFirst} · ` : ""}
            {page.title}:
          </span>{" "}
          <span className={waiting ? "font-semibold text-[#9bd5ff]" : "text-[var(--ava-muted)]"}>{summary}</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-[var(--ava-muted)] transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open ? (
        // A white card in her blue room, scrolling inside a set height so the chat stays usable.
        // The room's white caret would vanish on white.
        <div className="mx-1.5 mb-1.5 max-h-[50vh] overflow-y-auto rounded-xl bg-white p-3 text-slate-900 [&_textarea]:[caret-color:#0f172a]">
          <ActivityTab
            key={page.slug}
            coachId={knowledge.coach_id}
            coachName={coachName}
            scope={{ key: scopeKey, label: page.title, ava }}
            className=""
            embedded
            refreshKey={turns}
            onChanged={() => {
              reload();
              setSaves((n) => n + 1);
            }}
            onOpenPart={(_job, sectionKey) => {
              const ref = sectionByKey(sectionKey);
              if (!ref) return;
              onShow?.({ page: ref.page.slug, section: sectionKey, href: ref.page.href, label: ref.section.title });
            }}
          />
        </div>
      ) : null}
    </div>,
    slot
  );
}
