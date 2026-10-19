import { NextResponse } from "next/server";
import { loadLinkedInHistory } from "@/lib/linkedinHistory/loadHistory";
import { requireCoachRequest } from "@/lib/requireCoachRequest";

/** The coach's imported LinkedIn posts, newsletter issues and drafts. Admins pass x-impersonate-coach-id. */
export async function GET(request: Request) {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await loadLinkedInHistory(auth.userId));
  } catch (err) {
    console.error("linkedin history:", err);
    return NextResponse.json({ error: "Could not load your LinkedIn history." }, { status: 500 });
  }
}
