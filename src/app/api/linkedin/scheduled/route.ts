import { NextResponse } from "next/server";
import { requireAdminBearer } from "@/lib/linkedinAdminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Body = {
  content?: string;
  scheduled_for?: string;
};

export async function GET(request: Request) {
  const auth = await requireAdminBearer(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("linkedin_scheduled_posts")
    .select(
      "id, content, scheduled_for, status, attempts, last_error, linkedin_post_urn, published_at, created_at"
    )
    .eq("user_id", auth.userId)
    .order("scheduled_for", { ascending: true })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: "Could not load scheduled posts." }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireAdminBearer(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const content = body.content?.trim() ?? "";
  const scheduledFor = body.scheduled_for?.trim() ?? "";
  const when = new Date(scheduledFor);

  if (!content) {
    return NextResponse.json({ error: "Post content is required." }, { status: 400 });
  }
  if (!scheduledFor || Number.isNaN(when.getTime())) {
    return NextResponse.json({ error: "Valid scheduled_for is required." }, { status: 400 });
  }
  if (when.getTime() < Date.now() + 60_000) {
    return NextResponse.json(
      { error: "Scheduled time must be at least 1 minute in the future." },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("linkedin_scheduled_posts")
    .insert({
      user_id: auth.userId,
      content,
      scheduled_for: when.toISOString(),
      status: "scheduled",
    })
    .select("id, content, scheduled_for, status, attempts, last_error, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: "Could not create scheduled post." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, item: data });
}
