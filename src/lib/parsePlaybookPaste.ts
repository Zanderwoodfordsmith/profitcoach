/**
 * Parse pasted full playbook content into form fields.
 * Used by admin playbook edit form.
 */

import type {
  PlayItem,
  PlaySection,
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
  playsIntro: string;
  plays: PlayItem[];
  playsSections: PlaySection[];
  quickWins: string[];
  relatedPlaybooks: RelatedPlaybookItem[];
}>;

const SECTION_HEADERS = [
  "What This Is",
  "What It Looks Like",
  "Things to Think About",
  "The Plays Inside This Playbook",
  "Quick Wins",
  "Related Playbooks",
] as const;

function getSectionContent(text: string, header: string): string | null {
  const escaped = header.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const otherHeaders = SECTION_HEADERS.filter((h) => h !== header)
    .map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const re = new RegExp(
    `(?:^|\\n)\\s*${escaped}\\s*\\n([\\s\\S]*?)(?=\\n\\s*(?:${otherHeaders})\\s*\\n|$)`,
    "i"
  );
  const match = text.match(re);
  return match ? match[1].trim() : null;
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

function parsePlaysSection(section: string): {
  playsIntro?: string;
  plays?: PlayItem[];
  playsSections?: PlaySection[];
} | null {
  if (!section.trim()) return null;

  const lines = section.split(/\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  const sections: PlaySection[] = [];
  let playsIntro = "";
  let pending: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const playMatch = line.match(PLAY_LINE_RE);

    if (playMatch) {
      if (pending.length > 0) {
        let title = "";
        let desc = "";
        if (pending.length >= 3) {
          playsIntro = pending.slice(0, -2).join("\n").trim();
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
          plays: [],
        });
        pending = [];
      } else if (sections.length === 0) {
        sections.push({ title: "", description: "", plays: [] });
      }

      const last = sections[sections.length - 1];
      last.plays.push({
        number: parseInt(playMatch[1], 10),
        title: playMatch[2].trim(),
        description: playMatch[3].trim(),
      });
    } else {
      pending.push(line);
    }
  }

  if (sections.length === 0) {
    return pending.length > 0 ? { playsIntro: pending.join("\n").trim() } : null;
  }

  const hasSections = sections.length > 1 || (sections.length === 1 && sections[0].title);
  if (hasSections) {
    return {
      playsIntro: playsIntro || undefined,
      playsSections: sections,
    };
  }

  return {
    playsIntro: playsIntro || undefined,
    plays: sections.flatMap((s) => s.plays),
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

  const playsRaw = getSectionContent(text, "The Plays Inside This Playbook");
  if (playsRaw) {
    const parsed = parsePlaysSection(playsRaw);
    if (parsed) {
      if (parsed.playsIntro) result.playsIntro = parsed.playsIntro;
      if (parsed.plays) result.plays = parsed.plays;
      if (parsed.playsSections) result.playsSections = parsed.playsSections;
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
