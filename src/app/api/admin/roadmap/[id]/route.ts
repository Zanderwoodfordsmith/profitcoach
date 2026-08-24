import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import {
  deleteRoadmapJob,
  updateRoadmapJob,
  type UpdateRoadmapJobInput,
} from "@/lib/roadmap/core";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const { id } = await params;
  let body: UpdateRoadmapJobInput;
  try {
    body = (await request.json()) as UpdateRoadmapJobInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  try {
    const job = await updateRoadmapJob(id, body);
    return NextResponse.json({ job });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not update job.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const { id } = await params;
  try {
    await deleteRoadmapJob(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not delete job.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
