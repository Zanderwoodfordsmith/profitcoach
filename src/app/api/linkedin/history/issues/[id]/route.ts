import { NextResponse } from "next/server";
import { loadIssueBody } from "@/lib/linkedinHistory/loadHistory";
import { requireCoachRequest } from "@/lib/requireCoachRequest";

/** The full text of one imported newsletter issue. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  const blocks = await loadIssueBody(auth.userId, id);
  return NextResponse.json({ blocks });
}
