import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { addProjectUpdate, latestProjectUpdates, listProjectUpdates } from "@/lib/roadmap/projects";

export const runtime = "nodejs";

/** ?project=Name (repeat for several): their updates, newest first. No project: every project's latest (health dots). */
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });
  const projects = new URL(request.url).searchParams.getAll("project").filter(Boolean);
  try {
    const updates = projects.length ? await listProjectUpdates(projects) : await latestProjectUpdates();
    return NextResponse.json({ updates });
  } catch (e) {
    console.error("roadmap project updates GET:", e);
    return NextResponse.json({ error: "Could not load updates." }, { status: 500 });
  }
}

/** Post one: { project, health: on_track | at_risk | off_track, body? }. */
export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const project = typeof body?.project === "string" ? body.project.trim() : "";
  if (!project) return NextResponse.json({ error: "Which project?" }, { status: 400 });
  try {
    return NextResponse.json({ update: await addProjectUpdate(project, body!, auth.userId) }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not post the update.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
