import { NextResponse } from "next/server";

import { loadBoardCoaches } from "@/lib/practiceKnowledge/boardData";
import { requireAdmin } from "@/lib/requireAdmin";

export const runtime = "nodejs";

export type { BoardCoach } from "@/lib/practiceKnowledge/boardData";

/**
 * Admin → Coaches → Launches (3 Nov): every coach with a Blueprint, each
 * page in the column for whose move it is, with Ava's open work and unread
 * chat messages for BCA.
 */
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.error === "Server error." ? 500 : 401 });

  try {
    const { coaches, pages } = await loadBoardCoaches();
    return NextResponse.json({ coaches, pages: pages.map((p) => ({ slug: p.slug, title: p.title })) });
  } catch (err) {
    console.error("admin blueprints:", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Could not load the Blueprints." }, { status: 500 });
  }
}
