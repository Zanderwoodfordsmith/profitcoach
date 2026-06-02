import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { likelyFemaleFirstName } from "@/lib/directoryGenderHint";

type RpcRow = {
  slug: string;
  directory_level: string | null;
  full_name: string | null;
  coach_business_name: string | null;
  avatar_url: string | null;
  directory_summary: string | null;
  location: string | null;
  linkedin_url: string | null;
  total_count: string | number | null;
};

type CoachListItem = {
  slug: string;
  directory_level: string | null;
  full_name: string | null;
  coach_business_name: string | null;
  avatar_url: string | null;
  directory_summary: string | null;
  location: string | null;
  linkedin_url: string | null;
};

function hasPhoto(c: CoachListItem): boolean {
  return Boolean(c.avatar_url && c.avatar_url.trim());
}

function hasSummary(c: CoachListItem): boolean {
  return Boolean(c.directory_summary && c.directory_summary.trim());
}

/**
 * Ensures at least one likely-female coach (with photo + summary) appears in the
 * first 6 positions, and ideally two within the first 9. Only reorders by pulling
 * qualified profiles up; it never pushes anyone who already sorts early down past
 * the target slots, and it leaves the natural order otherwise intact.
 */
function promoteWomenEarly(list: CoachListItem[]): CoachListItem[] {
  if (list.length <= 6) return list;

  const result = [...list];
  const isQualified = (c: CoachListItem) =>
    hasPhoto(c) && hasSummary(c) && likelyFemaleFirstName(c.full_name);

  const countQualified = (limit: number) =>
    result.slice(0, limit).filter(isQualified).length;

  const promoteInto = (targetSlot: number, searchFrom: number) => {
    const idx = result.findIndex((c, i) => i >= searchFrom && isQualified(c));
    if (idx === -1) return;
    const [woman] = result.splice(idx, 1);
    result.splice(Math.min(targetSlot, result.length), 0, woman);
  };

  // At least one in the first 6 (target slot index 5).
  if (countQualified(6) < 1) {
    promoteInto(5, 6);
  }

  // Ideally two within the first 9 (target slot index 8).
  if (countQualified(9) < 2) {
    promoteInto(8, 9);
  }

  return result;
}

/**
 * Public, unauthenticated directory listing. Uses service role and `directory_coaches_page` RPC.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
    const pageSize = Math.min(
      60,
      Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "30", 10) || 30)
    );
    const search = (url.searchParams.get("search") ?? "").trim();
    const levelRaw = (url.searchParams.get("level") ?? "").trim();
    const location = (url.searchParams.get("location") ?? "").trim();

    const level =
      levelRaw && levelRaw !== "all" ? levelRaw : null;

    const { data, error } = await supabaseAdmin.rpc("directory_coaches_page", {
      p_search: search.length > 0 ? search : null,
      p_level: level,
      p_location: location.length > 0 ? location : null,
      p_limit: pageSize,
      p_offset: (page - 1) * pageSize,
    });

    if (error) {
      if (error.message?.includes("function") && error.message?.includes("does not exist")) {
        return NextResponse.json(
          {
            error:
              "Directory is not available until database migrations are applied.",
          },
          { status: 503 }
        );
      }
      console.error("directory/coaches rpc error:", error);
      return NextResponse.json(
        { error: "Could not load directory." },
        { status: 500 }
      );
    }

    const rows = (data ?? []) as RpcRow[];
    const first = rows[0];
    const total =
      first && first.total_count != null
        ? Number(first.total_count)
        : 0;

    let coaches = rows.map((r) => ({
      slug: r.slug,
      directory_level: r.directory_level,
      full_name: r.full_name,
      coach_business_name: r.coach_business_name,
      avatar_url: r.avatar_url,
      directory_summary: r.directory_summary,
      location: r.location,
      linkedin_url: r.linkedin_url,
    }));

    // When simply browsing (no search/filter), nudge a couple of women with a
    // photo + summary into the first row of the first page so the top of the
    // directory isn't all one demographic. The DB has no gender field, so this
    // relies on a conservative first-name heuristic.
    const isBrowse =
      search.length === 0 && level === null && location.length === 0;
    if (isBrowse && page === 1) {
      coaches = promoteWomenEarly(coaches);
    }

    return NextResponse.json({
      coaches,
      total,
      page,
      pageSize,
    });
  } catch (err) {
    console.error("directory/coaches GET catch:", err);
    return NextResponse.json(
      { error: "Could not load directory." },
      { status: 500 }
    );
  }
}
