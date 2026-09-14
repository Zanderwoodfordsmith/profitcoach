import { NextResponse } from "next/server";
import { openPoolPersonAsProspect } from "@/lib/pool/openPoolPersonAsProspect";
import { isLeadListUuid } from "@/lib/leadLists/audienceLists";
import { requireCoachRequest } from "@/lib/requireCoachRequest";

type Ctx = { params: Promise<{ itemId: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error || !auth.userId) {
    return NextResponse.json(
      { error: auth.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  const { itemId } = await ctx.params;
  if (!isLeadListUuid(itemId)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  try {
    const result = await openPoolPersonAsProspect({
      coachId: auth.userId,
      itemId,
    });
    return NextResponse.json(result, {
      status: result.created ? 201 : 200,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not open pool person.";
    const status =
      message === "Pool person not found."
        ? 404
        : message.includes("needs a LinkedIn")
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
