/**
 * The building blocks of the call script, shared by every step and every
 * objection page: lines to say, the owner's replies, coaching notes, ⓘ
 * toggles for the why, and colour-coded toggles for each way they answer.
 */

import type { ObjectionId } from "./objections";

/** red: weakest answer. orange, yellow: partway. green: go on or close. blue: a neutral fork. */
export type Tone = "red" | "orange" | "yellow" | "green" | "blue";

export type Block =
  | { type: "heading"; text: string }
  | { type: "say"; text: string }
  | { type: "they"; text: string }
  | { type: "note"; text: string }
  | { type: "points"; items: string[] }
  | { type: "info"; title: string; body: string[] }
  | { type: "response"; tone: Tone; label: string; blocks: Block[] }
  | { type: "goto"; text: string; to: ObjectionId }
  /** A YouTube video that plays in place. Shorts are upright. */
  | { type: "video"; title: string; youtubeId: string; upright?: boolean }
  /** Opens BOSS Pro in a new tab on a new person, with the owner's name and business from the gaps. */
  | { type: "bossPro"; text: string }
  /** Opens Profit levers in a new tab, titled with the owner's business from the gaps. */
  | { type: "levers"; text: string }
  /** Pick the owner's level and constraint, and see that playbook's questions and this-week wins. */
  | { type: "playbook" }
  /** Where the call screen drops in something written live: the read-back or the pitch. */
  | { type: "live"; part: LivePart }
  /** Something the coach sends rather than says: a text, an email, a DM. Shown in a box with Copy. */
  | { type: "message"; label: string; text: string }
  /** A plain list of guidance, not lines to say. */
  | { type: "list"; items: string[] }
  /** A link to another script, or one part of it. */
  | { type: "see"; text: string; script: string; part?: string };

export type LivePart = "readback" | "pitch";

/** Answers always read best to worst, left to right, so the coach's eye knows where to look. */
const TONE_ORDER: Tone[] = ["green", "yellow", "blue", "orange", "red"];

export function inToneOrder<T extends { tone: Tone }>(answers: T[]): T[] {
  return [...answers].sort((a, b) => TONE_ORDER.indexOf(a.tone) - TONE_ORDER.indexOf(b.tone));
}

export const h = (text: string): Block => ({ type: "heading", text });
export const say = (text: string): Block => ({ type: "say", text });
export const they = (text: string): Block => ({ type: "they", text });
export const note = (text: string): Block => ({ type: "note", text });
export const points = (...items: string[]): Block => ({ type: "points", items });
export const info = (title: string, ...body: string[]): Block => ({ type: "info", title, body });
export const r = (tone: Tone, label: string, ...blocks: Block[]): Block => ({ type: "response", tone, label, blocks });
export const go = (text: string, to: ObjectionId): Block => ({ type: "goto", text, to });
export const live = (part: LivePart): Block => ({ type: "live", part });
export const bossPro = (text: string): Block => ({ type: "bossPro", text });
export const levers = (text: string): Block => ({ type: "levers", text });
export const playbook = (): Block => ({ type: "playbook" });
export const message = (label: string, text: string): Block => ({ type: "message", label, text });
export const list = (...items: string[]): Block => ({ type: "list", items });
export const see = (text: string, script: string, part?: string): Block => ({ type: "see", text, script, part });
export const video = (title: string, youtubeId: string, upright = false): Block => ({ type: "video", title, youtubeId, upright });
