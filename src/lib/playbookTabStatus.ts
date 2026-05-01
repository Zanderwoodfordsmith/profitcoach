/**
 * Derive playbook tab status (done | in_progress | not_started) from content.
 * Overview is derived from whatThisIs/actions; Client/Coaches default to not_started
 * until we have content for those tabs.
 */

import type { PlaybookContent } from "./playbookContentTypes";
import { loadPlaybookContentSync } from "./playbookContent";
import { PLAYBOOKS } from "./bossData";

export type TabStatus = "done" | "in_progress" | "not_started";

export type PlaybookTabStats = {
  ref: string;
  overview: TabStatus;
  client: TabStatus;
  coaches: TabStatus;
};

function deriveOverviewStatus(content: PlaybookContent): TabStatus {
  const hasWhatThisIs = (content.whatThisIs?.trim().length ?? 0) > 100;
  const hasActions =
    (content.actions?.length ?? 0) > 0 ||
    (content.actionSections?.some((s) => (s.actions?.length ?? 0) > 0) ?? false);
  const hasWhatItLooksLike =
    content.whatItLooksLike?.broken?.content?.trim() ||
    content.whatItLooksLike?.ok?.content?.trim() ||
    content.whatItLooksLike?.working?.content?.trim();
  const hasThings = (content.thingsToThinkAbout?.length ?? 0) > 0;
  const hasQuickWins = (content.quickWins?.length ?? 0) > 0;

  if (hasWhatThisIs && hasActions && hasWhatItLooksLike) return "done";
  if (hasWhatThisIs || hasActions || hasThings || hasQuickWins) return "in_progress";
  return "not_started";
}

/** Get tab stats for a single playbook from loaded content. */
export function getPlaybookTabStats(content: PlaybookContent): PlaybookTabStats {
  return {
    ref: content.ref,
    overview: deriveOverviewStatus(content),
    client: "not_started", // TODO: derive from content when Client tab has content
    coaches: "not_started", // TODO: derive from content when Coaches tab has content
  };
}

/** Get tab stats for all playbooks. */
export function getAllPlaybookTabStats(): PlaybookTabStats[] {
  return PLAYBOOKS.map((meta) => {
    const content = loadPlaybookContentSync(meta.ref);
    if (!content) {
      return {
        ref: meta.ref,
        overview: "not_started" as TabStatus,
        client: "not_started" as TabStatus,
        coaches: "not_started" as TabStatus,
      };
    }
    return getPlaybookTabStats(content);
  });
}
