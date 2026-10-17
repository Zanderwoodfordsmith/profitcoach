import * as fs from "node:fs";
import * as path from "node:path";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { composeRewriteSystem } from "./prompts";

/** The written method, shared with the Blueprint map, so editing the file changes the writer. */
export const LINKEDIN_METHOD_FILE = path.join("content", "practice-skills", "linkedin-profile.md");

function methodText(): string {
  try {
    return fs.readFileSync(path.join(process.cwd(), LINKEDIN_METHOD_FILE), "utf8");
  } catch {
    return "";
  }
}

export async function loadRewriteSystemPrompt(): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("linkedin_optimizer_prompt")
    .select("system_prompt")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("linkedin optimizer prompt load failed");
    return composeRewriteSystem(null, methodText());
  }

  const stored =
    typeof data?.system_prompt === "string" ? data.system_prompt : null;
  return composeRewriteSystem(stored, methodText());
}
