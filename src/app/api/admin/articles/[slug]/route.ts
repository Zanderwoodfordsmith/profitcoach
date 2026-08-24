import { NextResponse } from "next/server";

import { ARTICLE_STATUSES, type ArticleStatus } from "@/lib/articles";
import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const { slug } = await params;
  let body: { editorial_status?: string };
  try {
    body = (await request.json()) as { editorial_status?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const status = body.editorial_status;
  if (
    !status ||
    !(ARTICLE_STATUSES as readonly string[]).includes(status)
  ) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }
  const editorialStatus = status as ArticleStatus;

  const { error } = await supabaseAdmin
    .from("articles")
    .update({
      editorial_status: editorialStatus,
      // live <-> published stay in lockstep (bca-website pattern). Publishing
      // only affects visitors once the public blog reads the DB.
      published: editorialStatus === "live",
      published_at:
        editorialStatus === "live" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("slug", slug);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
