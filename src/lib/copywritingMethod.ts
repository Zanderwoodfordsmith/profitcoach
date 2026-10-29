import * as fs from "node:fs";
import * as path from "node:path";

import { peekAgentOverride } from "@/lib/agent/agentOverrides";

/** How to think and write any outward copy (content/ai-knowledge/copywriting-method.md). Every writer of owner-facing copy reads it. */
export const COPYWRITING_METHOD_FILE = path.join("content", "ai-knowledge", "copywriting-method.md");

export function readCopywritingMethod(): string {
  const override = peekAgentOverride("ai-knowledge/copywriting-method.md");
  if (override) return override;
  try {
    return fs.readFileSync(path.join(process.cwd(), COPYWRITING_METHOD_FILE), "utf8");
  } catch {
    return "";
  }
}

/**
 * The check pass: after a first draft, the writer is shown its own draft and
 * runs the method's checks (section 7) on it, then returns a fixed version in
 * the same format. One extra model call; most of the quality comes from here.
 */
export function copyCheckPrompt(user: string, draft: string): string {
  return [
    user,
    `## Your first draft\n\n${draft.slice(0, 14_000)}`,
    [
      "## Check it, then fix it",
      "Run the checks in section 7 of the copywriting method on this draft, one by one, as a demanding editor would. Then rewrite anything that fails. Keep what already passes.",
      "Facts stay exactly as they are in the inputs above: never add a number, client, result or year that is not there. Keep placeholders in square brackets.",
      "Return the improved version in exactly the same JSON format as before, and nothing else.",
    ].join("\n"),
  ].join("\n\n");
}
