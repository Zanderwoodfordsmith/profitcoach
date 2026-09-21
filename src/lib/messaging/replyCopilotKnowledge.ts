/**
 * Interpretable-context loading for the reply copilot.
 *
 * Layer 1: router (map of situations). Layer 3: shared rules.
 * Layer 2: only the situation files that match this reply.
 * Layer 4 (thread / prospect) stays in the user message.
 */

import * as fs from "node:fs";
import * as path from "node:path";

export const REPLY_COPILOT_ROUTER_FILE = "reply-copilot/ROUTER.md";
export const REPLY_COPILOT_SHARED_RULES_FILE = "reply-copilot/shared-rules.md";

export const REPLY_COPILOT_SITUATION_FILES = {
  interested: "reply-copilot/situations/interested.md",
  question: "reply-copilot/situations/question.md",
  "not-yet": "reply-copilot/situations/not-yet.md",
  "thumbs-up": "reply-copilot/situations/thumbs-up.md",
  "fine-for-now": "reply-copilot/situations/fine-for-now.md",
  "no-thanks": "reply-copilot/situations/no-thanks.md",
  objection: "reply-copilot/situations/objection.md",
  quiet: "reply-copilot/situations/quiet.md",
  "scorecard-done": "reply-copilot/situations/scorecard-done.md",
} as const;

export type ReplyCopilotSituationId = keyof typeof REPLY_COPILOT_SITUATION_FILES;

export const REPLY_COPILOT_SITUATION_IDS = Object.keys(
  REPLY_COPILOT_SITUATION_FILES
) as ReplyCopilotSituationId[];

const SITUATION_CAP = 4_000;
const SHARED_CAP = 6_000;

function capText(raw: string, max: number): string {
  if (raw.length <= max) return raw;
  return raw.slice(0, max) + "\n\n[Truncated.]";
}

function repoPathForKnowledgeFile(file: string): string {
  return path.join(process.cwd(), "content", "ai-knowledge", file);
}

export function readReplyCopilotRepoFile(file: string): string | null {
  const full = repoPathForKnowledgeFile(file);
  const root = path.resolve(path.join(process.cwd(), "content", "ai-knowledge")) + path.sep;
  const resolved = path.resolve(full);
  if (resolved !== path.resolve(root.slice(0, -1)) && !resolved.startsWith(root)) {
    return null;
  }
  if (!fs.existsSync(resolved)) return null;
  return fs.readFileSync(resolved, "utf8");
}

export function loadReplyCopilotRouterDefault(
  overrides?: Record<string, string> | null
): string {
  const fromOverride = overrides?.[REPLY_COPILOT_ROUTER_FILE]?.trim();
  if (fromOverride) return fromOverride;
  return (
    readReplyCopilotRepoFile(REPLY_COPILOT_ROUTER_FILE)?.trim() ||
    "You draft one reply a BCA coach can send. Follow shared rules. One next step."
  );
}

/** DB system_prompt wins. Else Knowledge-tab override. Else repo ROUTER.md. */
export function resolveReplyCopilotRouter(input: {
  storedPrompt?: string | null;
  overrides?: Record<string, string> | null;
}): { router: string; usingDefault: boolean } {
  const stored = (input.storedPrompt || "").trim();
  if (stored) return { router: stored, usingDefault: false };
  return {
    router: loadReplyCopilotRouterDefault(input.overrides),
    usingDefault: true,
  };
}

/**
 * Which situation files to load. Known tags scope the window.
 * Untagged threads get every situation so the model can classify in one pass.
 */
export function selectReplyCopilotSituationIds(input: {
  disposition?: string | null;
  bossScore?: number | null;
}): ReplyCopilotSituationId[] {
  if (typeof input.bossScore === "number" && Number.isFinite(input.bossScore)) {
    return ["scorecard-done"];
  }
  const disposition = (input.disposition || "").trim().toLowerCase();
  if (disposition === "interested") return ["interested", "question"];
  if (disposition === "not_interested") return ["no-thanks", "objection"];
  if (disposition === "neutral") {
    return ["not-yet", "thumbs-up", "fine-for-now", "quiet"];
  }
  return [...REPLY_COPILOT_SITUATION_IDS];
}

function resolveFile(
  file: string,
  overrides?: Record<string, string> | null
): string {
  const override = overrides?.[file]?.trim();
  if (override) return override;
  return readReplyCopilotRepoFile(file)?.trim() || "";
}

export function assembleReplyCopilotKnowledge(input: {
  disposition?: string | null;
  bossScore?: number | null;
  overrides?: Record<string, string> | null;
}): { markdown: string; situationIds: ReplyCopilotSituationId[]; files: string[] } {
  const situationIds = selectReplyCopilotSituationIds(input);
  const files: string[] = [REPLY_COPILOT_SHARED_RULES_FILE];
  const parts: string[] = [];

  const shared = capText(
    resolveFile(REPLY_COPILOT_SHARED_RULES_FILE, input.overrides),
    SHARED_CAP
  );
  if (shared) {
    parts.push(`# Reference: Shared rules\n\n${shared}`);
  }

  for (const id of situationIds) {
    const file = REPLY_COPILOT_SITUATION_FILES[id];
    files.push(file);
    const body = capText(resolveFile(file, input.overrides), SITUATION_CAP);
    if (!body) continue;
    parts.push(`# Loaded situation: ${id}\n\n${body}`);
  }

  return {
    markdown: parts.join("\n\n---\n\n"),
    situationIds,
    files,
  };
}
