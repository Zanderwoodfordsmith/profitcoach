"use client";

import Link from "next/link";
import { useState } from "react";

import type { AvaFileUser } from "@/lib/agent/avaCatalog";

/** Quiet chips for Admin → Ava: what reads a file, or what a skill opens. */

export const HINT = "Knowledge is how things are. A skill is a job with an end point.";

export const CHIP =
  "inline-flex max-w-full items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 [overflow-wrap:anywhere]";

const CHIP_LINK = `${CHIP} hover:bg-[#e0f2fe] hover:text-[#075985]`;

/** Soft red, like the Boxes tab: nothing reads it. */
export const UNUSED_CHIP =
  "inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-200";

export const SECTION_LABEL = "text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-[#94a3b8]";

export const KIND_LABEL: Record<AvaFileUser["kind"], string> = {
  ava: "Ava",
  writer: "Blueprint",
  create: "Create hub",
  feature: "Other",
};

export const KIND_ORDER: AvaFileUser["kind"][] = ["ava", "writer", "create", "feature"];

export function ChipLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} onClick={(e) => e.stopPropagation()} className={CHIP_LINK}>
      {children}
    </Link>
  );
}

/** "Used by", grouped by kind, with the long lists folded after `max` chips. `bare` drops the kind labels (one kind per column). */
export function UsedByChips({ users, max = 6, bare = false }: { users: AvaFileUser[]; max?: number; bare?: boolean }) {
  const [all, setAll] = useState(false);
  const sorted = KIND_ORDER.flatMap((kind) => users.filter((u) => u.kind === kind));
  const shown = all ? sorted : sorted.slice(0, max);
  const hidden = sorted.length - shown.length;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {shown.map((user, i) => (
        <span key={`${user.kind}:${user.id}`} className="inline-flex items-center gap-1">
          {!bare && (i === 0 || shown[i - 1].kind !== user.kind) ? (
            <span className="pl-0.5 text-[0.6875rem] font-semibold text-slate-400">{KIND_LABEL[user.kind]}</span>
          ) : null}
          <ChipLink href={user.href}>{user.label}</ChipLink>
        </span>
      ))}
      {hidden > 0 ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setAll(true);
          }}
          className="rounded-full px-2 py-0.5 text-xs font-semibold text-[#0c5290] hover:bg-[#e0f2fe]"
        >
          +{hidden} more
        </button>
      ) : null}
    </span>
  );
}
