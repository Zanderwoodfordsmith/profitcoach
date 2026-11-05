import { NextResponse } from "next/server";

import { isCronRequest } from "@/lib/cronAuth";
import { cardPoints, progressOf } from "@/lib/practiceKnowledge/blueprintBoard";
import { loadBoardCoaches } from "@/lib/practiceKnowledge/boardData";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Daily: save where every coach's Blueprint stands (4 Nov), so Launches can
 * show progress over time and how long pages sit in each status. One row per
 * coach per day; running twice in a day just updates that day's row.
 */
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { coaches } = await loadBoardCoaches();
    const day = new Date().toISOString().slice(0, 10);
    const rows = coaches.map((coach) => {
      const cards = Object.entries(coach.cards);
      const progress = progressOf(cards.map(([, card]) => card));
      return {
        coach_id: coach.coach_id,
        day,
        percent: progress.percent,
        points: progress.points,
        max_points: progress.max,
        pages: Object.fromEntries(
          cards.map(([slug, card]) => [slug, { column: card.column, tag: card.tag, points: cardPoints(card) }])
        ),
      };
    });
    if (rows.length) {
      const { error } = await supabaseAdmin.from("blueprint_progress_snapshots").upsert(rows, { onConflict: "coach_id,day" });
      if (error) throw new Error(error.message);
    }
    return NextResponse.json({ ok: true, day, coaches: rows.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Blueprint progress snapshot failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
