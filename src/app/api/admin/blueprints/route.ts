import { NextResponse } from "next/server";

import { loadLaunchList } from "@/lib/gettingLive";
import { loadBoardCoaches } from "@/lib/practiceKnowledge/boardData";
import { linkedInSetupState } from "@/lib/unipile/linkedinSetupState";
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
    const launchList = loadLaunchList().catch(() => null);
    // Sales Navigator is only known by asking Unipile (21 Nov): ask for the coaches we're launching as soon as we
    // know who they are, alongside the Blueprints rather than after them (23 Nov). Only connected ones reach Unipile.
    const salesNavLoad = launchList.then(
      async (list) =>
        new Map(await Promise.all([...(list?.keys() ?? [])].map(async (id) => [id, await linkedInSetupState(id).catch(() => null)] as const)))
    );
    const [{ coaches, pages }, salesNav] = await Promise.all([loadBoardCoaches({ launchList }), salesNavLoad]);
    const withSalesNav = coaches.map((coach) => {
      if (!coach.launching || !coach.linkedin_connected) return { ...coach, sales_navigator: null };
      const state = salesNav.get(coach.coach_id) ?? null;
      return { ...coach, sales_navigator: state === "ok" ? true : state === "sales_navigator" ? false : null };
    });
    return NextResponse.json({ coaches: withSalesNav, pages: pages.map((p) => ({ slug: p.slug, title: p.title })) });
  } catch (err) {
    console.error("admin blueprints:", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Could not load the Blueprints." }, { status: 500 });
  }
}
