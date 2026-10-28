import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createRoadmapInitiative, listRoadmapInitiatives, listRoadmapOwners, saveRoadmapInitiative } from "@/lib/roadmap/projects";

export const runtime = "nodejs";

/** Roadmap initiatives: the level above projects (Projects view). */
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });
  try {
    const [initiatives, owners] = await Promise.all([listRoadmapInitiatives(), listRoadmapOwners()]);
    return NextResponse.json({ initiatives, owners });
  } catch (e) {
    console.error("roadmap initiatives GET:", e);
    return NextResponse.json({ error: "Could not load initiatives." }, { status: 500 });
  }
}

/** Add one: { name, status? }. */
export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { name?: unknown; status?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Give the initiative a name." }, { status: 400 });
  try {
    return NextResponse.json({ initiative: await createRoadmapInitiative(name, body?.status) }, { status: 201 });
  } catch (e) {
    console.error("roadmap initiatives POST:", e);
    return NextResponse.json({ error: "Could not add the initiative." }, { status: 500 });
  }
}

/** Change one: { id, name?, goal?, brief?, status?, target?, owner_id?, sort_order? }. */
export async function PATCH(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Which initiative?" }, { status: 400 });
  try {
    return NextResponse.json({ initiative: await saveRoadmapInitiative(id, body!) });
  } catch (e) {
    console.error("roadmap initiatives PATCH:", e);
    return NextResponse.json({ error: "Could not save the initiative." }, { status: 500 });
  }
}
