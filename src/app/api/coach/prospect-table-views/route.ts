import { NextResponse } from "next/server";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import {
  createProspectTableViewForOwner,
  listProspectTableViewsForOwner,
} from "@/lib/prospects/prospectTableViewsServer";

export async function GET(request: Request) {
  const auth = await requireCoachRequest(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json(
      { error: auth.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const payload = await listProspectTableViewsForOwner({
      ownerId: auth.userId,
      surface: "coach",
    });
    return NextResponse.json(payload);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unable to load views.";
    console.error("coach prospect-table-views GET:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireCoachRequest(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json(
      { error: auth.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  try {
    const payload = await createProspectTableViewForOwner({
      ownerId: auth.userId,
      surface: "coach",
      name: typeof body.name === "string" ? body.name : "",
      settings: body.settings,
      makeActive: body.makeActive === true,
    });
    return NextResponse.json(payload);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unable to create view.";
    console.error("coach prospect-table-views POST:", err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
