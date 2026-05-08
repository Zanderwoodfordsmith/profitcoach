import { NextResponse } from "next/server";
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

  return NextResponse.json({
    calendar_embed_code:
      (data as { calendar_embed_code?: string | null } | null)
        ?.calendar_embed_code ?? null,
  });
}
