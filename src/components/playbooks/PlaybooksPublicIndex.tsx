"use client";

import { PlaybooksLibrary } from "@/components/playbooks/PlaybooksLibrary";
import type { PlaybookSummary } from "@/lib/playbookContentTypes";

export function PlaybooksPublicIndex({ summaries }: { summaries: PlaybookSummary[] }) {
  return (
    <PlaybooksLibrary
      summaries={summaries}
      eyebrow="Profit System"
      title="Playbooks"
      description="Explore every playbook by area. Open one for the full overview, actions, and related resources."
      buildHref={(ref) => `/playbooks/${ref}`}
      stickyBleedInset={false}
    />
  );
}
