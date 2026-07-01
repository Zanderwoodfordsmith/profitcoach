import { NextResponse } from "next/server";
import { loadPublicBossProDashboard } from "@/lib/publicBossProDashboard";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token")?.trim() ?? "";
  const coachSlugParam = url.searchParams.get("coach")?.trim().toLowerCase() ?? "";
  const businessSlugParam =
    url.searchParams.get("business")?.trim().toLowerCase() ?? "";

  const result = await loadPublicBossProDashboard({
    token,
    coachSlugParam,
    businessSlugParam,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data);
}
