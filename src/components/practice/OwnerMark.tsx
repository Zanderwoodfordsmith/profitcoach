"use client";

import type { WorkflowOwner } from "@/lib/practiceKnowledge/sectionWorkflow";

import { usePractice } from "./PracticeProvider";

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}

/** Who a section is waiting on: the coach's picture, or BCA. */
export function OwnerMark({ owner, size = "md" }: { owner: WorkflowOwner; size?: "sm" | "md" }) {
  const { coachName, coachAvatarUrl, viewer } = usePractice();
  const box = size === "sm" ? "h-6 w-6" : "h-7 w-7";
  const mark = size === "sm" ? "text-[8px]" : "text-[9px]";
  const label =
    owner === "bca"
      ? "Waiting on BCA"
      : viewer === "coach"
        ? "Waiting on you"
        : `Waiting on ${coachName || "the coach"}`;

  if (owner === "bca") {
    return (
      <span
        title={label}
        aria-label={label}
        className={`inline-flex ${box} ${mark} shrink-0 items-center justify-center rounded-full bg-[#0c5290] font-semibold tracking-[0.04em] text-white`}
      >
        BCA
      </span>
    );
  }

  return (
    <span title={label} aria-label={label} className={`inline-flex ${box} shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#eaf3fb] font-semibold text-[#0c5290] ${coachAvatarUrl ? "" : viewer === "coach" ? "text-[11px]" : mark}`}>
      {coachAvatarUrl ? (
        // The name lives on the wrapper.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coachAvatarUrl} alt="" className="h-full w-full object-cover" />
      ) : viewer === "coach" ? (
        "You"
      ) : (
        initials(coachName || "Coach")
      )}
    </span>
  );
}
