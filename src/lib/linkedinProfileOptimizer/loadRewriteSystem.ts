import * as fs from "node:fs";
import * as path from "node:path";

import { readCopywritingMethod } from "@/lib/copywritingMethod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { composeRewriteSystem } from "./prompts";
import { PROFILE_SECTIONS, type ProfileSectionId } from "./types";

/** The written method, shared with the Blueprint map, so editing the file changes the writer. */
export const LINKEDIN_METHOD_FILE = path.join("content", "practice-skills", "linkedin-profile.md");
/** One file per part ({section}.md): its rules, examples and mistakes. */
const LINKEDIN_PARTS_DIR = path.join("content", "practice-skills", "linkedin-profile");

function readRepoFile(file: string): string {
  try {
    return fs.readFileSync(path.join(process.cwd(), file), "utf8");
  } catch {
    return "";
  }
}

/** The shared method, then the part being written (every part when none is given). */
function methodText(section?: ProfileSectionId): string {
  const parts = section ? [section] : PROFILE_SECTIONS;
  return [
    readRepoFile(LINKEDIN_METHOD_FILE),
    ...parts.map((s) => readRepoFile(path.join(LINKEDIN_PARTS_DIR, `${s}.md`))),
    readCopywritingMethod(),
  ]
    .filter(Boolean)
    .join("\n\n---\n\n");
}

export async function loadRewriteSystemPrompt(section?: ProfileSectionId): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("linkedin_optimizer_prompt")
    .select("system_prompt")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("linkedin optimizer prompt load failed");
    return composeRewriteSystem(null, methodText(section));
  }

  const stored =
    typeof data?.system_prompt === "string" ? data.system_prompt : null;
  return composeRewriteSystem(stored, methodText(section));
}
