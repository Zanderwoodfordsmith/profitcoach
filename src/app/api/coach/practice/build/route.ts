import { NextResponse } from "next/server";

import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { buildSection, isBuildableSection } from "@/lib/practiceKnowledge/buildSection";
import { sanitizeBlocks } from "@/lib/practiceKnowledge/blocks";
import { ensurePracticeKnowledge, saveBuiltSection } from "@/lib/practiceKnowledge/store";

/**
 * Writes one "We build" section of the Practice Blueprint for the coach.
 * The page calls this once per section, in build order, so each call fits
 * well inside the time limit and later sections can read earlier ones.
 */
export const maxDuration = 300;

export async function POST(request: Request) {
  const check = await requireCoachRequest(request, { allowAdminSelf: true });
  if (check.error || !check.userId) {
    return NextResponse.json({ error: check.error ?? "Unauthorized" }, { status: 401 });
  }

  let body: { section?: string; clear?: boolean; blocks?: unknown } = {};
  try {
    body = (await request.json()) as { section?: string; clear?: boolean; blocks?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const key = String(body.section ?? "");
  if (!isBuildableSection(key)) {
    return NextResponse.json({ error: "That section is not one we write." }, { status: 400 });
  }

  try {
    // The coach edited the text: keep it, and remember it was edited.
    if (body.blocks !== undefined) {
      const blocks = sanitizeBlocks(body.blocks);
      const current = (await ensurePracticeKnowledge(check.userId)).built_sections[key];
      if (!blocks.length || !current) {
        return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
      }
      const knowledge = await saveBuiltSection({
        coachId: check.userId,
        key,
        section: { ...current, blocks, edited_at: new Date().toISOString() },
      });
      return NextResponse.json({ knowledge });
    }
    const knowledge =
      body.clear === true
        ? await saveBuiltSection({ coachId: check.userId, key, section: null })
        : await buildSection(check.userId, key);
    return NextResponse.json({ knowledge });
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed";
    console.error("practice build:", message);
    return NextResponse.json({ error: "Could not write this section. Try again." }, { status: 502 });
  }
}
