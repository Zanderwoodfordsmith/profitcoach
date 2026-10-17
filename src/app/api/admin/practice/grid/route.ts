import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/requireAdmin";
import { gridCells, type GridCoach } from "@/lib/practiceKnowledge/blueprintGrid";
import { summariseThreads } from "@/lib/practiceKnowledge/sectionCommentTypes";
import { commentHeadsForCoaches } from "@/lib/practiceKnowledge/sectionComments";
import { mapKnowledgeRow } from "@/lib/practiceKnowledge/store";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/** Coaches → Blueprint: every coach with a Blueprint, every section's state, and unread comments for BCA. */
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    const status = auth.error === "Server error." ? 500 : 401;
    return NextResponse.json({ error: auth.error }, { status });
  }

  try {
    const { data: rows, error } = await supabaseAdmin
      .from("coach_practice_knowledge")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);

    const ids = (rows ?? []).map((r) => String((r as { coach_id: string }).coach_id));
    const [profiles, heads] = await Promise.all([
      ids.length
        ? supabaseAdmin
            .from("profiles")
            .select("id, full_name, first_name, last_name, avatar_url, access_removed_at")
            .in("id", ids)
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
      commentHeadsForCoaches(ids),
    ]);

    const people = new Map(
      ((profiles.data ?? []) as Record<string, unknown>[]).map((p) => [String(p.id), p])
    );

    const coaches: GridCoach[] = [];
    for (const raw of rows ?? []) {
      const row = mapKnowledgeRow(raw as Record<string, unknown>);
      const person = people.get(row.coach_id) as
        | { full_name?: string | null; first_name?: string | null; last_name?: string | null; avatar_url?: string | null; access_removed_at?: string | null }
        | undefined;
      // People who have left keep their profile, but are not worked on.
      if (!person || person.access_removed_at) continue;
      const reads = Object.fromEntries(
        heads.reads.filter((r) => r.coach_id === row.coach_id).map((r) => [r.section_key, r.read_at])
      );
      coaches.push({
        coach_id: row.coach_id,
        name:
          person.full_name?.trim() ||
          [person.first_name, person.last_name].filter(Boolean).join(" ").trim() ||
          "Coach",
        avatar_url: person.avatar_url?.trim() || null,
        completeness_score: row.completeness_score,
        updated_at: row.updated_at,
        cells: gridCells(row),
        threads: summariseThreads(
          heads.comments.filter((c) => c.coach_id === row.coach_id),
          "bca",
          reads
        ),
      });
    }

    return NextResponse.json({ coaches });
  } catch (err) {
    console.error("admin blueprint grid:", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Could not load the Blueprint overview." }, { status: 500 });
  }
}
