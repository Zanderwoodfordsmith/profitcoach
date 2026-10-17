import { NextResponse } from "next/server";

import { loadRewriteSystemPrompt } from "@/lib/linkedinProfileOptimizer/loadRewriteSystem";
import { loadBlueprintContext } from "@/lib/practiceKnowledge/blueprintContext";
import { sectionPrompt } from "@/lib/practiceKnowledge/buildSection";
import { flowGraph } from "@/lib/practiceKnowledge/flow";
import { SECTION_SKILLS, skillSystemPrompt } from "@/lib/practiceKnowledge/skills";
import { findPracticeKnowledge } from "@/lib/practiceKnowledge/store";
import { requireAdmin } from "@/lib/requireAdmin";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * For the admin flow map: exactly what one writer is sent. Without a coach,
 * the fixed part (method, rules, format). With ?coach=, the full prompt with
 * that coach's answers, as the build would send it. Nothing is written.
 */
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    const status = auth.error === "Server error." ? 500 : 401;
    return NextResponse.json({ error: auth.error }, { status });
  }

  const params = new URL(request.url).searchParams;
  const nodeId = params.get("node") ?? "";
  const rawCoach = params.get("coach");
  const coachId = rawCoach && UUID.test(rawCoach) ? rawCoach : null;
  const node = flowGraph().nodes.find((n) => n.id === nodeId);
  if (!node?.writer?.preview) {
    return NextResponse.json({ error: "That box has no prompt." }, { status: 404 });
  }

  try {
    if (node.writer.preview === "section" && node.sectionKey && SECTION_SKILLS[node.sectionKey]) {
      if (!coachId) {
        return NextResponse.json({ system: skillSystemPrompt(node.sectionKey), user: null, note: "Pick a coach to see the full prompt with their answers." });
      }
      const row = await findPracticeKnowledge(coachId);
      if (!row) return NextResponse.json({ error: "That coach has no Blueprint yet." }, { status: 404 });
      const { system, user } = await sectionPrompt(coachId, node.sectionKey, row);
      return NextResponse.json({ system, user, note: null });
    }

    if (node.writer.preview === "linkedin") {
      const system = await loadRewriteSystemPrompt();
      const blueprint = coachId ? await loadBlueprintContext(coachId) : "";
      return NextResponse.json({
        system,
        user: blueprint || null,
        note: "Each part of the profile (headline, About, experience, banner, Featured) is rewritten on its own. The message carries that part's current text, the LinkedIn summary, the older coach brain and the shared Blueprint summary shown here.",
      });
    }

    // The everyday AI tools: each has its own instructions; all of them are given this summary.
    const blueprint = coachId ? await loadBlueprintContext(coachId) : "";
    return NextResponse.json({
      system: null,
      user: blueprint || null,
      note: coachId
        ? "Profit Coach AI, the Chrome extension, the newsletter and the agent each keep their own instructions. All of them are given this Blueprint summary."
        : "Pick a coach to see the Blueprint summary these tools are given.",
    });
  } catch (err) {
    console.error("practice flow prompt:", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Could not build the prompt." }, { status: 500 });
  }
}
