import { NextResponse } from "next/server";
import { getPublicDirectoryCoachBySlug } from "@/lib/publicDirectoryCoach";

/** Public coach profile for directory detail pages. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const coach = await getPublicDirectoryCoachBySlug(slug ?? "");
  if (!coach) {
    return NextResponse.json({ error: "Coach not found" }, { status: 404 });
  }
  return NextResponse.json(coach);
}
