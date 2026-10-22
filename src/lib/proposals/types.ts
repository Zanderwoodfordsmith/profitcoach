/** A coach's proposal for one prospect (table coach_proposals). */

export const PROPOSAL_SECTION_KEYS = ["intro", "how", "investment", "next", "faq", "terms"] as const;
export type ProposalSectionKey = (typeof PROPOSAL_SECTION_KEYS)[number];

/**
 * One part of the proposal. The body is plain text: blank lines split
 * paragraphs, "## " starts a small heading, "- " starts a bullet.
 */
export type ProposalSection = {
  key: ProposalSectionKey;
  title: string;
  body: string;
  /** Left out of what the prospect sees. */
  hidden?: boolean;
};

export type ProposalStatus = "draft" | "sent" | "opened" | "signed" | "archived";

export type Proposal = {
  id: string;
  coach_id: string;
  contact_id: string | null;
  prospect_name: string;
  prospect_business: string | null;
  prospect_email: string | null;
  title: string | null;
  sections: ProposalSection[];
  status: ProposalStatus;
  share_token: string;
  sent_at: string | null;
  sent_to: string | null;
  first_opened_at: string | null;
  last_opened_at: string | null;
  open_count: number;
  signed_at: string | null;
  signed_name: string | null;
  created_at: string;
  updated_at: string;
};

export const PROPOSAL_COLUMNS =
  "id, coach_id, contact_id, prospect_name, prospect_business, prospect_email, title, sections, status, share_token, sent_at, sent_to, first_opened_at, last_opened_at, open_count, signed_at, signed_name, created_at, updated_at";

/** Keep only well-formed sections, in a known order of keys, each once. */
export function cleanSections(raw: unknown): ProposalSection[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: ProposalSection[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const s = item as Record<string, unknown>;
    const key = String(s.key ?? "");
    if (!(PROPOSAL_SECTION_KEYS as readonly string[]).includes(key) || seen.has(key)) continue;
    seen.add(key);
    out.push({
      key: key as ProposalSectionKey,
      title: String(s.title ?? "").trim().slice(0, 120) || key,
      body: String(s.body ?? "").slice(0, 20000),
      ...(s.hidden === true ? { hidden: true } : {}),
    });
  }
  return out;
}

export type ProposalBlock = { kind: "p" | "h"; text: string } | { kind: "ul"; items: string[] };

/** Turns a section body into paragraphs, small headings and bullet lists. */
export function parseProposalBody(body: string): ProposalBlock[] {
  const blocks: ProposalBlock[] = [];
  let para: string[] = [];
  let list: string[] | null = null;
  const flushPara = () => {
    if (para.length) blocks.push({ kind: "p", text: para.join(" ") });
    para = [];
  };
  const flushList = () => {
    if (list?.length) blocks.push({ kind: "ul", items: list });
    list = null;
  };
  for (const raw of body.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) {
      flushPara();
      flushList();
    } else if (line.startsWith("## ")) {
      flushPara();
      flushList();
      blocks.push({ kind: "h", text: line.slice(3).trim() });
    } else if (/^[-•]\s+/.test(line)) {
      flushPara();
      (list ??= []).push(line.replace(/^[-•]\s+/, ""));
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return blocks;
}

export function proposalPath(token: string): string {
  return `/proposal/${token}`;
}
