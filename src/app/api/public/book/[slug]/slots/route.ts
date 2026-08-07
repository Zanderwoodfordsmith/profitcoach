import { NextResponse } from "next/server";
import { loadCoachBySlug } from "@/lib/booking/bookingService";

/** Legacy slots → Discovery calendar slots. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const coach = await loadCoachBySlug(slug ?? "");
  if (!coach) {
    return NextResponse.json({ error: "Coach not found." }, { status: 404 });
  }
  const url = new URL(request.url);
  const target = new URL(
    `/api/public/book/${encodeURIComponent(coach.slug)}/discovery/slots`,
    url.origin
  );
  target.search = url.search;
  return NextResponse.redirect(target);
}
