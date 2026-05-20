import { NextResponse } from "next/server";
import {
  PRIMARY_COACH_CALENDAR_EMBED_CODE,
  PRIMARY_COACH_SLUG_FALLBACK,
} from "@/lib/primaryCoach";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const cleanSlug = slug?.trim();

  if (!cleanSlug) {
    return NextResponse.json({ calendar_embed_code: null }, { status: 200 });
  }

  const { data, error } = await supabaseAdmin
    .from("coaches")
    .select("calendar_embed_code")
    .eq("slug", cleanSlug)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Could not load calendar embed." },
      { status: 500 }
    );
  }

  const storedEmbed =
    (data as { calendar_embed_code?: string | null } | null)
      ?.calendar_embed_code ?? null;

  const isPrimaryCoach =
    cleanSlug.toLowerCase() === PRIMARY_COACH_SLUG_FALLBACK.toLowerCase();

  return NextResponse.json({
    calendar_embed_code:
      storedEmbed ??
      (isPrimaryCoach ? PRIMARY_COACH_CALENDAR_EMBED_CODE : null),
  });
}
