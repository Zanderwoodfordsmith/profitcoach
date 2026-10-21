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
  /** Where the call screen drops in something written live: the read-back or the pitch. */
  | { type: "live"; part: LivePart };

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
export const video = (title: string, youtubeId: string, upright = false): Block => ({ type: "video", title, youtubeId, upright });
