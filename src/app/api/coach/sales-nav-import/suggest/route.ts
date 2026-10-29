import { NextResponse } from "next/server";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { suggestSalesNavSearches } from "@/lib/salesNavigator/prospectSearch/suggestFromBlueprint";

export const maxDuration = 60;

/** Ready-to-import Sales Nav searches from the coach's Blueprint. */
export async function POST(request: Request) {
  const check = await requireCoachRequest(request, { allowAdminSelf: true });
  if (check.error || !check.userId) {
    return NextResponse.json({ error: check.error ?? "Unauthorized" }, { status: 401 });
  }
  const result = await suggestSalesNavSearches(check.userId);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
