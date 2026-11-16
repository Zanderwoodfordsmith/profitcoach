import { NextResponse } from "next/server";

import { toCheckItems } from "@/lib/launch/avaAuto";
import { requireAdmin } from "@/lib/requireAdmin";

export const runtime = "nodejs";

/** Everything Ava has waiting for BCA, across coaches, oldest first (Launches → To check). */
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.error === "Server error." ? 500 : 401 });
  try {
    return NextResponse.json({ items: await toCheckItems() });
  } catch (err) {
    console.error("to check:", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Could not load what's waiting." }, { status: 500 });
  }
}
