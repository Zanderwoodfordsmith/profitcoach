/**
 * Announcement writer: Ava turns an admin's rough note into one Announcements
 * post (title + body). The same post can also go to the WhatsApp group, so
 * this file also converts the community markdown into WhatsApp formatting.
 *
 * Skill text: content/ai-knowledge/announcement-writer/ROUTER.md, editable in
 * Admin → Brand → Core brain.
 */

import { readReplyCopilotRepoFile } from "@/lib/messaging/replyCopilotKnowledge";

export const ANNOUNCEMENT_WRITER_FILE = "announcement-writer/ROUTER.md";
export const ANNOUNCEMENT_WRITER_MAX_TOKENS = 1200;
export const ANNOUNCEMENT_NOTE_MAX = 3000;

const WRITING_RULES_FILE = "writing-rules.md";
const SKILL_CAP = 12_000;
const RULES_CAP = 10_000;

const FALLBACK =
  "You turn an admin's rough note into one short BCA community announcement with a title, emoji-numbered points, the time in UK time and the calls link https://businesscoachacademy.com/calls. Never invent facts. No em dashes.";

/** Locked in code so a bad Core brain edit cannot break parsing. */
const OUTPUT_CONTRACT = `Output
- First line: TITLE: <the title>
- Then one blank line, then the post body.
- Body is plain text with blank lines between paragraphs. **bold** and [label](url) links are allowed. No headings, no code fences, no preamble.
- Never use the em dash character.`;

function cap(raw: string, max: number): string {
  return raw.length <= max ? raw : raw.slice(0, max) + "\n\n[Truncated.]";
}

function knowledgeFile(
  file: string,
  overrides: Record<string, string> | null | undefined
): string {
  return (
    overrides?.[file]?.trim() || readReplyCopilotRepoFile(file)?.trim() || ""
  );
}

export function composeAnnouncementSystem(
  overrides?: Record<string, string> | null
): string {
  const skill = cap(
    knowledgeFile(ANNOUNCEMENT_WRITER_FILE, overrides) || FALLBACK,
    SKILL_CAP
  );
  const rules = cap(knowledgeFile(WRITING_RULES_FILE, overrides), RULES_CAP);
  const parts = [skill];
  if (rules) parts.push(`# WRITING RULES\n\n${rules}`);
  parts.push(OUTPUT_CONTRACT);
  return parts.join("\n\n");
}

export type UpcomingCall = { title: string; startsAtIso: string };

/** "Mon 17 Nov, 4pm (UK)" */
export function formatUkCallTime(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Europe/London",
  });
  const time = d
    .toLocaleTimeString("en-GB", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Europe/London",
    })
    .replace(":00", "")
    .replace(/\s/g, "");
  return `${day}, ${time} (UK)`;
}

export function composeAnnouncementUserMessage(input: {
  note: string;
  senderName: string | null;
  upcoming: UpcomingCall[];
  now?: Date;
}): string {
  const now = input.now ?? new Date();
  const today = now.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  });
  const calls =
    input.upcoming.length > 0
      ? input.upcoming
          .map((c) => `- ${formatUkCallTime(c.startsAtIso)}: ${c.title}`)
          .join("\n")
      : "(none found)";
  return [
    `TODAY (UK): ${today}`,
    `SENDER: ${input.senderName?.trim() || "(unknown)"}`,
    "",
    "UPCOMING CALLS (next 7 days, from the Academy calendar):",
    calls,
    "",
    "ROUGH NOTE (from the admin. Follow it. It may be dictated or messy):",
    '"""',
    input.note.trim().slice(0, ANNOUNCEMENT_NOTE_MAX),
    '"""',
    "",
    "Write the announcement.",
  ].join("\n");
}

/** Split the model's reply into title + body. */
export function parseAnnouncementDraft(
  raw: string
): { title: string; body: string } | null {
  let text = raw.trim();
  const fence = text.match(/^```(?:\w+)?\s*([\s\S]*?)```$/);
  if (fence) text = fence[1].trim();
  text = text.replace(/\s*—\s*/g, " - ");
  const match = text.match(/^\s*TITLE:\s*(.+?)\s*(?:\n|$)([\s\S]*)$/i);
  if (!match) return null;
  const title = match[1].replace(/^\*\*|\*\*$/g, "").trim();
  const body = match[2].trim();
  if (!title || !body) return null;
  return { title, body };
}

/**
 * Community markdown → WhatsApp text.
 * **bold** → *bold*, [label](url) → url (or "label: url"), mentions → @Name,
 * headings → bold lines.
 */
export function toWhatsAppText(input: {
  title: string;
  body: string;
  postUrl?: string | null;
}): string {
  const body = input.body
    .replace(/\[@([^\]]+)\]\(mention:[^)]+\)/g, "@$1")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_m, label: string, url: string) => {
      const l = label.trim();
      return l === url || l.replace(/^https?:\/\//, "") === url.replace(/^https?:\/\//, "")
        ? url
        : `${l}: ${url}`;
    })
    .replace(/^#{1,6}\s*(.+)$/gm, "*$1*")
    .replace(/\*\*([^*\n]+)\*\*/g, "*$1*")
    .replace(/__([^_\n]+)__/g, "*$1*")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const title = input.title.replace(/\*/g, "").trim();
  const parts = [`*${title}*`, body];
  if (input.postUrl) parts.push(`Comment in the Academy: ${input.postUrl}`);
  return parts.join("\n\n");
}
