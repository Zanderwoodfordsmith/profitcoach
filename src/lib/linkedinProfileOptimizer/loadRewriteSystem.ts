import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { composeRewriteSystem } from "./prompts";

export async function loadRewriteSystemPrompt(): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("linkedin_optimizer_prompt")
    .select("system_prompt")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("linkedin optimizer prompt load failed");
    return composeRewriteSystem(null);
  }

  const stored =
    typeof data?.system_prompt === "string" ? data.system_prompt : null;
  return composeRewriteSystem(stored);
}
