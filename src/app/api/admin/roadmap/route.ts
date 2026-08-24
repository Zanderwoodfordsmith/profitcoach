import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import {
  createRoadmapJob,
  isRoadmapStatus,
  listRoadmapJobs,
  type CreateRoadmapJobInput,
} from "@/lib/roadmap/core";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const url = new URL(request.url);
  const area = url.searchParams.get("area");
  const statusRaw = url.searchParams.get("status");
  const status = statusRaw && isRoadmapStatus(statusRaw) ? statusRaw : null;
  try {
    const jobs = await listRoadmapJobs({ area, status });
    return NextResponse.json({ jobs });
  } catch (e) {
    console.error("roadmap GET:", e);
    return NextResponse.json({ error: "Could not load jobs." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  let body: CreateRoadmapJobInput;
  try {
    body = (await request.json()) as CreateRoadmapJobInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  try {
    const job = await createRoadmapJob(body);
    return NextResponse.json({ job }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not create job.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
