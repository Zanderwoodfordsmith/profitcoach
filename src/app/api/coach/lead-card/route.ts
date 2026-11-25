import { NextResponse } from "next/server";
import { loadLeadCard } from "@/lib/leads/leadCard";
import { requireOutreachCoach } from "@/lib/unipile/requireOutreachCoach";

/** The lead hover card: GET ?url=<LinkedIn profile>&company=<LinkedIn company id>. */
export async function GET(request: Request) {
  const auth = await requireOutreachCoach(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const params = new URL(request.url).searchParams;
  const url = params.get("url")?.trim() || null;
  const company = params.get("company")?.trim() || null;
  const website = params.get("website")?.trim().slice(0, 300) || null;
  const companyName = params.get("name")?.trim().slice(0, 200) || null;
  if (url && !/linkedin\.com\//i.test(url)) {
    return NextResponse.json({ error: "Not a LinkedIn link." }, { status: 400 });
  }
  if (!url && !company && !website) {
    return NextResponse.json({ error: "Nothing to look up." }, { status: 400 });
  }
  try {
    const card = await loadLeadCard(auth.coachId, { linkedinUrl: url, companyId: company, website, companyName });
    return NextResponse.json({ card });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not load." }, { status: 500 });
  }
}
