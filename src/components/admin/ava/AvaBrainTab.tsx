"use client";

import type { AvaCatalog } from "@/lib/agent/avaCatalog";

import { AvaDocument } from "./AvaDocument";
import { AvaSplit } from "./AvaList";

/**
 * Admin → Ava → Brain: the three files Ava reads in every chat, in the editor
 * with history, and the pages that check her work in the sidebar.
 */

export const BRAIN_FILES = [
  { id: "agent/AGENT.md", label: "Who Ava is" },
  { id: "agent/ROUTER.md", label: "Router" },
  { id: "agent/VOICE.md", label: "Voice" },
] as const;

const CHECKS = [
  { id: "replies", label: "Reply review", href: "/admin/ava/replies" },
  { id: "nudges", label: "Nudges", href: "/admin/ava?tab=nudges" },
  { id: "evals", label: "Evals", href: "/admin/ava/evals" },
  { id: "audit", label: "Coach audit", href: "/admin/client-success/quality" },
];

export function AvaBrainTab({
  catalog,
  openId,
  onOpen,
  onCatalog,
}: {
  catalog: AvaCatalog;
  openId: string | null;
  onOpen: (id: string) => void;
  onCatalog: (catalog: AvaCatalog) => void;
}) {
  const current = BRAIN_FILES.find((f) => f.id === openId) ?? BRAIN_FILES[0];
  const file = catalog.files.find((f) => f.id === current.id);

  const sections = [
    {
      id: "every",
      label: "Every chat",
      items: BRAIN_FILES.map((f) => ({
        id: f.id,
        label: f.label,
        current: f.id === current.id,
        note: catalog.files.find((r) => r.id === f.id)?.missing ? "missing" : undefined,
        onOpen: () => onOpen(f.id),
      })),
    },
    { id: "checks", label: "Check her work", items: CHECKS },
  ];

  return (
    <AvaSplit sections={sections}>
      {file ? (
        <AvaDocument
          file={file}
          title={current.label}
          summary={file.missing ? "This file is not in the repo yet. Save it here and Ava reads it from her next turn." : file.description}
          meta="read in every chat, keep it short"
          onCatalog={onCatalog}
        />
      ) : null}
    </AvaSplit>
  );
}
