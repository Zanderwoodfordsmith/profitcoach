import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { duplicateLibraryItem } from "@/lib/campaignLibrary/store";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const { id } = await ctx.params;
  try {
    const item = await duplicateLibraryItem(id);
    if (!item) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ item });
  } catch (err) {
    console.error("admin/campaign-library/[id]/duplicate POST", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
