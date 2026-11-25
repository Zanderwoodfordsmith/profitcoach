import { NextResponse } from "next/server";

import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { buildSection, isBuildableSection } from "@/lib/practiceKnowledge/buildSection";
import { sanitizeBlocks, sanitizePublish } from "@/lib/practiceKnowledge/blocks";
import { isNewsletterLibraryKey } from "@/lib/practiceKnowledge/newsletters";
import { ensurePracticeKnowledge, patchBuiltSections, saveBuiltSection } from "@/lib/practiceKnowledge/store";

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

  let body: { section?: string; clear?: boolean; blocks?: unknown; publish?: unknown; order?: unknown } = {};
  try {
    body = (await request.json()) as { section?: string; clear?: boolean; blocks?: unknown; publish?: unknown; order?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  // The coach's newsletter drafts in a new order (Newsletter tab, drag to reorder).
  if (Array.isArray(body.order)) {
    const order = body.order.filter((k): k is string => typeof k === "string" && /^content:(newsletter|analogy|kpis|nl-[a-z0-9]{6,12})$/.test(k)).slice(0, 80);
    try {
      const knowledge = await patchBuiltSections(check.userId, (k, section) => {
        const at = order.indexOf(k);
        return at < 0 ? null : { ...section, position: at };
      });
      return NextResponse.json({ knowledge });
    } catch (err) {
      console.error("practice build order:", err instanceof Error ? err.message : "failed");
      return NextResponse.json({ error: "Could not save the order." }, { status: 502 });
    }
  }
  const key = String(body.section ?? "");
  // A newsletter issue marked draft, scheduled or published (Newsletter tab). The text stays as it is.
  if (body.publish !== undefined && (isNewsletterLibraryKey(key) || isBuildableSection(key))) {
    try {
      const current = (await ensurePracticeKnowledge(check.userId)).built_sections[key];
      if (!current) return NextResponse.json({ error: "Nothing to mark." }, { status: 400 });
      const knowledge = await saveBuiltSection({
        coachId: check.userId,
        key,
        section: { ...current, publish: sanitizePublish(body.publish) },
      });
      return NextResponse.json({ knowledge });
    } catch (err) {
      console.error("practice build publish:", err instanceof Error ? err.message : "failed");
      return NextResponse.json({ error: "Could not save that." }, { status: 502 });
    }
  }
  if (isNewsletterLibraryKey(key)) {
    try {
      if (body.clear === true) {
        const knowledge = await saveBuiltSection({ coachId: check.userId, key, section: null });
        return NextResponse.json({ knowledge });
      }
      if (body.blocks === undefined) {
        return NextResponse.json({ error: "That section is not one we write." }, { status: 400 });
      }
      const blocks = sanitizeBlocks(body.blocks);
      if (!blocks.length) {
        return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
      }
      const current = (await ensurePracticeKnowledge(check.userId)).built_sections[key];
      const at = new Date().toISOString();
      const knowledge = await saveBuiltSection({
        coachId: check.userId,
        key,
        section: current
          ? { ...current, blocks, edited_at: at }
          : { blocks, generated_at: at, model: "coach", edited_at: at },
      });
      return NextResponse.json({ knowledge });
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed";
      console.error("practice build:", message);
      return NextResponse.json({ error: "Could not save this newsletter. Try again." }, { status: 502 });
    }
  }
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
