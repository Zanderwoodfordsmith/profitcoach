import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { cleanProjectPatch, createRoadmapProject, listRoadmapProjects, saveRoadmapProject } from "@/lib/roadmap/projects";

export const runtime = "nodejs";

/** Roadmap projects: stage, goal, impact, ease and loose dates (Projects view). */
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });
  try {
    return NextResponse.json({ projects: await listRoadmapProjects() });
  } catch (e) {
    console.error("roadmap projects GET:", e);
    return NextResponse.json({ error: "Could not load projects." }, { status: 500 });
  }
}

/** Change one project's fields: { name, stage?, goal?, impact?, ease?, start_on?, target_on?, sort_order? }. */
export async function PATCH(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Which project?" }, { status: 400 });
  try {
    return NextResponse.json({ project: await saveRoadmapProject(name, cleanProjectPatch(body!)) });
  } catch (e) {
    console.error("roadmap projects PATCH:", e);
    return NextResponse.json({ error: "Could not save the project." }, { status: 500 });
  }
}

/** A new project: { name, stage?, goal?, brief?, initiative_id?, impact?, ease? }. */
export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const name = typeof body?.name === "string" ? body.name : "";
  try {
    return NextResponse.json({ project: await createRoadmapProject(name, cleanProjectPatch(body ?? {})) }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not create the project.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
