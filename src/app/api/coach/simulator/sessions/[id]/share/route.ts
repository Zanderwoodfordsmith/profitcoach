import { NextResponse } from "next/server";

import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveClient } from "@/lib/simulator/custom";
import { difficultyById } from "@/lib/simulator/difficulty";
import { ownSession, updateSession } from "@/lib/simulator/server";
import { situationById } from "@/lib/simulator/situations";

/** Community categories a practice session can go in. */
const CATEGORIES: Record<string, string> = {
  feedback: "requesting-feedback",
  wins: "wins",
};

function origin(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  return forwarded ? `${proto}://${forwarded}` : new URL(request.url).origin;
}

/** A ready-made post the coach can edit before sharing. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireCoachRequest(request, { allowAdminSelf: true });
  if (check.error || !check.userId) {
    return NextResponse.json({ error: check.error ?? "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const row = await ownSession(check, id, { write: true });
  const client = row ? await resolveClient(row.client_id, check) : null;
  const situation = row ? situationById(row.situation_id) : null;
  if (!row?.report || !client || !situation) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const level = difficultyById(row.difficulty)?.label ?? row.difficulty;
  const score = row.reviewed_score ?? row.score;
  return NextResponse.json({
    title: `I practised a ${situation.title.toLowerCase()} with ${client.firstName} on ${level}`,
    body: [
      `${client.firstName} is ${client.line.charAt(0).toLowerCase()}${client.line.slice(1)}`,
      `${score !== null ? `I scored ${score} out of 50. ` : ""}${row.report.summary}`,
      `What I'm working on next: ${row.report.oneThing}`,
      "Here's the report and the recording if you'd like to see how I ran it. Any feedback welcome.",
    ].join("\n\n"),
    shared: Boolean(row.shared_at),
  });
}

/** Share the session with the community: other coaches can open the report and listen back. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireCoachRequest(request, { allowAdminSelf: true });
  if (check.error || !check.userId) {
    return NextResponse.json({ error: check.error ?? "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const row = await ownSession(check, id, { write: true });
  const client = row ? await resolveClient(row.client_id, check) : null;
  if (!row?.report || !client) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const body = (await request.json().catch(() => null)) as { title?: unknown; body?: unknown; showScore?: unknown; category?: unknown } | null;
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 200) : "";
  const text = typeof body?.body === "string" ? body.body.trim().slice(0, 4000) : "";
  if (!title || !text) return NextResponse.json({ error: "Add a title and a few words." }, { status: 400 });
  const showScore = body?.showScore !== false;
  const slug = CATEGORIES[String(body?.category)] ?? CATEGORIES.feedback;

  const { data: category } = await supabaseAdmin.from("community_categories").select("id").eq("slug", slug).maybeSingle();
  if (!category) return NextResponse.json({ error: "Couldn't find that community category." }, { status: 500 });

  const site = origin(request);
  const link = `${site}/coach/simulator/${row.id}`;
  const face = client.face ? (client.face.startsWith("http") ? client.face : `${site}${client.face}`) : null;
  // The score never appears in the post when the coach hides it.
  const cleanText = showScore ? text : text.replace(/I scored \d+ out of 50\.\s*/g, "");

  await updateSession(id, { shared_at: new Date().toISOString(), share_score: showScore });
  const { data: post, error } = await supabaseAdmin
    .from("community_posts")
    .insert({
      author_id: check.userId,
      category_id: category.id,
      title,
      body: `${cleanText}\n\n[Open the session and listen back](${link})`,
      image_url: face,
      published_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !post) {
    console.error("simulator share:", error?.message);
    return NextResponse.json({ error: "Couldn't post to the community." }, { status: 500 });
  }
  return NextResponse.json({ postId: post.id, link });
}

/** Stop sharing: the report goes private again. The community post stays until the coach deletes it. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireCoachRequest(request, { allowAdminSelf: true });
  if (check.error || !check.userId) {
    return NextResponse.json({ error: check.error ?? "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const row = await ownSession(check, id, { write: true });
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });
  await updateSession(id, { shared_at: null });
  return NextResponse.json({ ok: true });
}
