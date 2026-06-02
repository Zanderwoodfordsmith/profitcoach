import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/** Distinct, recency-ordered values from a list of {value, updated_at} rows. */
function distinctByRecency(
  rows: { value: string | null; updated_at: string }[]
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of rows) {
    const trimmed = (row.value ?? "").trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

export async function GET(request: Request) {
  const authCheck = await requireAdmin(request);
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json(
      { error: authCheck.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const userId = url.searchParams.get("userId")?.trim() || authCheck.userId;

  const { data, error } = await supabaseAdmin
    .from("time_tracker_block")
    .select("title, category, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1000);

  if (error) {
    console.error("time-tracker suggestions GET:", error);
    return NextResponse.json(
      { error: "Unable to load suggestions." },
      { status: 500 }
    );
  }

  const rows = (data ?? []) as {
    title: string | null;
    category: string | null;
    updated_at: string;
  }[];

  return NextResponse.json({
    titles: distinctByRecency(
      rows.map((r) => ({ value: r.title, updated_at: r.updated_at }))
    ),
    categories: distinctByRecency(
      rows.map((r) => ({ value: r.category, updated_at: r.updated_at }))
    ),
  });
}
