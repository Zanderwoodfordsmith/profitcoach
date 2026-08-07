import { NextResponse } from "next/server";
import { loadCoachBySlug } from "@/lib/booking/bookingService";

/**
 * Legacy `/api/public/book/[slug]` → Discovery calendar endpoints.
 * Prefer `/api/public/book/[slug]/[calendarSlug]`.
 */
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
    `/api/public/book/${encodeURIComponent(coach.slug)}/discovery`,
    url.origin
  );
  return NextResponse.redirect(target);
}

export async function POST(
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
    `/api/public/book/${encodeURIComponent(coach.slug)}/discovery`,
    url.origin
  );
  const body = await request.text();
  return fetch(target.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}
