import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/requireAdmin";
import { BLUEPRINT_SECTIONS, sectionState, type SectionState } from "@/lib/practiceKnowledge/blueprint";
import { normalizePracticePayload } from "@/lib/practiceKnowledge/sourced";
import type { PracticeKnowledgeRow } from "@/lib/practiceKnowledge/types";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * For the admin Blueprint map: where every coach stands on every section.
 * Returns states only (ready, open, building, live), never the content.
 */
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    const status = auth.error === "Server error." ? 500 : 401;
    return NextResponse.json({ error: auth.error }, { status });
  }

  try {
    const { data: rows, error } = await supabaseAdmin
      .from("coach_practice_knowledge")
      .select("coach_id, payload, built_sections")
      .order("updated_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);

    const ids = (rows ?? []).map((r) => r.coach_id as string);
    const { data: profiles } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", ids)
      : { data: [] as { id: string; full_name: string | null }[] };
    const names = new Map((profiles ?? []).map((p) => [p.id as string, (p.full_name as string | null) || "Coach"]));

    const coaches = (rows ?? []).map((r) => {
      const row = {
        payload: normalizePracticePayload(r.payload),
        built_sections: (r.built_sections ?? {}) as PracticeKnowledgeRow["built_sections"],
      } as PracticeKnowledgeRow;
      const states: Record<string, SectionState> = {};
      for (const ref of BLUEPRINT_SECTIONS) states[ref.key] = sectionState(ref, row);
      return { coach_id: r.coach_id as string, name: names.get(r.coach_id as string) ?? "Coach", states };
    });

    return NextResponse.json({ coaches });
  } catch (err) {
    console.error("practice coverage:", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Could not load coverage." }, { status: 500 });
  }
}
