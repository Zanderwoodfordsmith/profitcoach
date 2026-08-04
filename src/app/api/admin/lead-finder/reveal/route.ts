import { NextResponse } from "next/server";
import { LeadrocksError } from "@/lib/apify/leadrocks";
import { requireLeadFinderAccess } from "@/lib/requireLeadFinderAccess";
import { revealLeadFinderLeads } from "@/lib/leadFinder/searchLeadFinder";

export async function POST(request: Request) {
  const auth = await requireLeadFinderAccess(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json(
      { error: auth.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    ids?: string[];
  };
  const ids = Array.isArray(body.ids) ? body.ids.map(String) : [];

  try {
    const leads = await revealLeadFinderLeads(ids);
    return NextResponse.json({ leads });
  } catch (err) {
    if (err instanceof LeadrocksError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    console.error("Lead finder reveal failed:", err);
    return NextResponse.json({ error: "Reveal failed." }, { status: 502 });
  }
}
