import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { loadNetworkCoaches } from "@/lib/referrals/network";

export const runtime = "nodejs";

/** Coaches for the Referrals picker: networks loaded first, then coaches with campaigns. */
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });
  try {
    return NextResponse.json({ coaches: await loadNetworkCoaches() });
  } catch (err) {
    console.error("admin referrals coaches:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not load coaches." }, { status: 500 });
  }
}
