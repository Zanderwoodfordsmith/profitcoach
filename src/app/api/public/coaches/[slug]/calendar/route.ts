import { NextResponse } from "next/server";
import { resolvePublicBookingSurface } from "@/lib/booking/coachBookingProviderServer";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const cleanSlug = slug?.trim();

  if (!cleanSlug) {
    return NextResponse.json(
      {
        provider: "ghl",
        calendar_embed_code: null,
        coach_slug: null,
        calendar_slug: null,
      },
      { status: 200 }
    );
  }

  try {
    const surface = await resolvePublicBookingSurface({ slug: cleanSlug });
    if (!surface) {
      return NextResponse.json(
        {
          provider: "ghl",
          calendar_embed_code: null,
          coach_slug: cleanSlug,
          calendar_slug: null,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(surface);
  } catch (err) {
    console.error("public coaches calendar:", err);
    return NextResponse.json(
      { error: "Could not load calendar embed." },
      { status: 500 }
    );
  }
}
