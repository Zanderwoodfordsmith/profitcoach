import { theProfitCoachMirrorResponse } from "@/lib/theProfitCoachMirrorHtml";

export const runtime = "nodejs";

export async function GET() {
  return theProfitCoachMirrorResponse("home.html");
}
