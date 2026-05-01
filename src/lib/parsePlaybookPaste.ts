/**
 * Parse pasted full playbook content into form fields.
 * Used by admin playbook edit form.
 */

import type {
  ActionItem,
  ActionSection,
  RelatedPlaybookItem,
  WhatItLooksLikeItem,
} from "./playbookContentTypes";

/** Partial form update returned by the parser. Only successfully parsed fields are present. */
export type ParsedPlaybookForm = Partial<{
  whatThisIs: string;
  whatItLooksLike: {
    broken: WhatItLooksLikeItem;
    ok: WhatItLooksLikeItem;
    working: WhatItLooksLikeItem;
  };
  thingsToThinkAbout: string[];
  actionsIntro: string;
  actions: ActionItem[];
  actionSections: ActionSection[];
  quickWins: string[];
  relatedPlaybooks: RelatedPlaybookItem[];
}>;

const SECTION_HEADERS = [
  "What This Is",
  "What It Looks Like",
  "Things to Think About",
  "The Plays Inside This Playbook",
  "The Actions Inside This Playbook",
  "Quick Wins",
  "Related Playbooks",
] as const;

function escHeader(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Match `What This Is` or `## What This Is` / `## **What This Is**` (markdown exports). */
function getSectionContent(text: string, header: string): string | null {
  const h = escHeader(header);
  const otherHeaders = SECTION_HEADERS.filter((x) => x !== header).map(escHeader).join("|");
  const re = new RegExp(
    `(?:^|\\n)\\s*(?:##\\s+)?(?:\\*\\*)?${h}(?:\\*\\*)?\\s*\\n([\\s\\S]*?)(?=\\n\\s*(?:##\\s+)?(?:\\*\\*)?(?:${otherHeaders})(?:\\*\\*)?\\s*\\n|$)`,
    "i"
  );
  const match = text.match(re);
  return match ? match[1].trim() : null;
}

function getPlaysOrActionsSection(text: string): string | null {
  return (
    getSectionContent(text, "The Actions Inside This Playbook") ??
    getSectionContent(text, "The Plays Inside This Playbook")
  );
}

function parseWhatItLooksLike(section: string): ParsedPlaybookForm["whatItLooksLike"] | null {
  const blocks: { emoji: string; label: string; key: "broken" | "ok" | "working" }[] = [
    { emoji: "🔴", label: "When this is broken", key: "broken" },
    { emoji: "🟠", label: "When this is OK", key: "ok" },
    { emoji: "🟢", label: "When this is working", key: "working" },
  ];

  const result: {
    broken: WhatItLooksLikeItem;
    ok: WhatItLooksLikeItem;
    working: WhatItLooksLikeItem;
  } = {
    broken: { label: "When this is broken", emoji: "🔴", content: "" },
    ok: { label: "When this is OK", emoji: "🟠", content: "" },
    working: { label: "When this is working", emoji: "🟢", content: "" },
  };

  let found = 0;
  for (const block of blocks) {
    const re = new RegExp(
      `${block.emoji}\\s*${block.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\n([\\s\\S]*?)(?=${blocks.map((b) => b.emoji).join("|")}|$)`,
      "i"
    );
    const match = section.match(re);
    if (match) {
      result[block.key] = {
        emoji: block.emoji,
        label: block.label,
        content: match[1].trim(),
      };
      found++;
    }
  }
  return found > 0 ? result : null;
}

function splitIntoItems(text: string): string[] {
  return text
    .split(/\n+/)
    .map((s) => s.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean);
}

/** Play N: Title — Description (accepts em dash or hyphen) */
const PLAY_LINE_RE = /^Play\s+(\d+):\s*(.+?)\s+[—\-]\s*(.+)$/;
/** **Play N: Title** (description may follow on subsequent lines) */
const PLAY_BOLD_LINE_RE = /^\*\*Play\s+(\d+):\s*(.+?)\*\*\s*$/;

function flushPendingIntoSections(
  pending: string[],
  sections: ActionSection[],
  actionsIntro: { value: string }
) {
  if (pending.length === 0) return;
  let title = "";
  let desc = "";
  if (pending.length >= 3) {
    actionsIntro.value = pending.slice(0, -2).join("\n").trim();
    title = pending[pending.length - 2] ?? "";
    desc = pending[pending.length - 1] ?? "";
  } else if (pending.length === 2) {
    title = pending[0] ?? "";
    desc = pending[1] ?? "";
  } else {
    title = pending[0] ?? "";
  }
  sections.push({
    title,
    description: desc,
    actions: [],
  });
}

function parsePlaysSection(section: string): {
  actionsIntro?: string;
  actions?: ActionItem[];
  actionSections?: ActionSection[];
} | null {
  if (!section.trim()) return null;

  const lines = section.split(/\n/).map((l) => l.trim());
  if (lines.length === 0) return null;

  const sections: ActionSection[] = [];
  const actionsIntroHolder = { value: "" };
  let pending: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line) continue;

    if (line.startsWith("###")) {
      if (pending.length > 0) {
        if (sections.length === 0) {
          actionsIntroHolder.value = pending.join("\n").trim();
        } else {
          const last = sections[sections.length - 1]!;
          last.description = [last.description, pending.join("\n").trim()]
            .filter(Boolean)
            .join("\n\n");
        }
        pending = [];
      }
      const title = line.replace(/^###+\s*/, "").replace(/\*\*/g, "").trim();
      sections.push({ title, description: "", actions: [] });
      continue;
    }

    const boldMatch = line.match(PLAY_BOLD_LINE_RE);
    if (boldMatch) {
      if (pending.length > 0) {
        if (sections.length === 0) {
          actionsIntroHolder.value = pending.join("\n").trim();
        } else {
          const last = sections[sections.length - 1]!;
          last.description = [last.description, pending.join("\n").trim()]
            .filter(Boolean)
            .join("\n\n");
        }
        pending = [];
      }
      if (sections.length === 0) {
        sections.push({ title: "", description: "", actions: [] });
      }

      const last = sections[sections.length - 1]!;
      const num = parseInt(boldMatch[1], 10);
      const titlePart = boldMatch[2].trim();
      const descParts: string[] = [];
      let j = i + 1;
      while (
        j < lines.length &&
        lines[j] &&
        !PLAY_BOLD_LINE_RE.test(lines[j]!) &&
        !PLAY_LINE_RE.test(lines[j]!) &&
        !lines[j]!.startsWith("###")
      ) {
        descParts.push(lines[j]!);
        j++;
      }
      i = j - 1;
      last.actions.push({
        number: num,
        title: titlePart,
        description: descParts.join("\n\n").trim() || titlePart,
      });
      continue;
    }

    const playMatch = line.match(PLAY_LINE_RE);
    if (playMatch) {
      if (pending.length > 0) {
        if (sections.length === 0) {
          flushPendingIntoSections(pending, sections, actionsIntroHolder);
        } else {
          const last = sections[sections.length - 1]!;
          last.description = [last.description, pending.join("\n").trim()]
            .filter(Boolean)
            .join("\n\n");
        }
        pending = [];
      } else if (sections.length === 0) {
        sections.push({ title: "", description: "", actions: [] });
      }

      const last = sections[sections.length - 1]!;
      last.actions.push({
        number: parseInt(playMatch[1], 10),
        title: playMatch[2].trim(),
        description: playMatch[3].trim(),
      });
    } else {
      pending.push(line);
    }
  }

  if (sections.length === 0) {
    return pending.length > 0 ? { actionsIntro: pending.join("\n").trim() } : null;
  }

  if (pending.length > 0) {
    if (sections.length === 0) {
      actionsIntroHolder.value = pending.join("\n").trim();
    } else {
      const last = sections[sections.length - 1]!;
      last.description = [last.description, pending.join("\n").trim()].filter(Boolean).join("\n\n");
    }
  }

  const actionsIntro = actionsIntroHolder.value;
  const hasRealSections =
    sections.length > 1 || (sections.length === 1 && Boolean(sections[0]!.title));
  if (hasRealSections) {
    return {
      actionsIntro: actionsIntro || undefined,
      actionSections: sections,
    };
  }

  return {
    actionsIntro: actionsIntro || undefined,
    actions: sections.flatMap((s) => s.actions),
  };
}

function parseRelatedPlaybooks(section: string): RelatedPlaybookItem[] {
  const items: RelatedPlaybookItem[] = [];
  for (const line of section.split(/\n/).map((l) => l.trim()).filter(Boolean)) {
    const refMatch = line.match(/^(\d+\.\d+)\s/);
    const ref = refMatch ? refMatch[1] : "";
    const dashIdx = line.search(/\s[—\-]\s/);
    const description = dashIdx >= 0 ? line.slice(dashIdx).replace(/^\s*[—\-]\s*/, "").trim() : "";
    if (ref) {
      items.push({ ref, description });
    }
  }
  return items;
}

export function parsePastedPlaybookContent(text: string): ParsedPlaybookForm {
  const result: ParsedPlaybookForm = {};

  const whatThisIs = getSectionContent(text, "What This Is");
  if (whatThisIs) result.whatThisIs = whatThisIs;

  const whatItLooksLikeRaw = getSectionContent(text, "What It Looks Like");
  if (whatItLooksLikeRaw) {
    const parsed = parseWhatItLooksLike(whatItLooksLikeRaw);
    if (parsed) result.whatItLooksLike = parsed;
  }

  const thingsRaw = getSectionContent(text, "Things to Think About");
  if (thingsRaw) {
    const items = splitIntoItems(thingsRaw);
    if (items.length > 0) result.thingsToThinkAbout = items;
  }

  const playsRaw = getPlaysOrActionsSection(text);
  if (playsRaw) {
    const parsed = parsePlaysSection(playsRaw);
    if (parsed) {
      if (parsed.actionsIntro) result.actionsIntro = parsed.actionsIntro;
      if (parsed.actions) result.actions = parsed.actions;
      if (parsed.actionSections) result.actionSections = parsed.actionSections;
    }
  }

  const quickWinsRaw = getSectionContent(text, "Quick Wins");
  if (quickWinsRaw) {
    const items = splitIntoItems(quickWinsRaw);
    if (items.length > 0) result.quickWins = items;
  }

  const relatedRaw = getSectionContent(text, "Related Playbooks");
  if (relatedRaw) {
    const items = parseRelatedPlaybooks(relatedRaw);
    if (items.length > 0) result.relatedPlaybooks = items;
  }

  return result;
}
