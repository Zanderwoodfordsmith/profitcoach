import { NextResponse } from "next/server";
import { requireOutreachCoach } from "@/lib/unipile/requireOutreachCoach";
import {
  deleteCoachTemplate,
  renameCoachTemplate,
} from "@/lib/campaignLibrary/instantiate";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** Rename one of the coach's own templates. BCA's templates can't be changed here. */
export async function PATCH(request: Request, ctx: Ctx) {
  const auth = await requireOutreachCoach(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as { name?: unknown };
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : "";
  if (!name) {
    return NextResponse.json({ error: "Give it a name." }, { status: 400 });
  }
  try {
    const template = await renameCoachTemplate(auth.coachId, id, name);
    if (!template) {
      return NextResponse.json({ error: "Template not found." }, { status: 404 });
    }
    return NextResponse.json({ template });
  } catch (err) {
    console.error("coach/linkedin-outreach/campaign-templates/[id] PATCH", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  const auth = await requireOutreachCoach(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const { id } = await ctx.params;
  try {
    const deleted = await deleteCoachTemplate(auth.coachId, id);
    if (!deleted) {
      return NextResponse.json({ error: "Template not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("coach/linkedin-outreach/campaign-templates/[id] DELETE", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
