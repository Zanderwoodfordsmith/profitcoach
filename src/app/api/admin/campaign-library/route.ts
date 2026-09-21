import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import {
  parseLibraryItemType,
  parseLibraryKind,
} from "@/lib/campaignLibrary/sanitize";
import {
  createLibraryItem,
  listLibraryItems,
} from "@/lib/campaignLibrary/store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const url = new URL(request.url);
  const itemType = parseLibraryItemType(url.searchParams.get("type"));
  if (!itemType) {
    return NextResponse.json(
      { error: "type must be template, sequence, or step." },
      { status: 400 }
    );
  }
  const kindParam = url.searchParams.get("kind");
  const kind = kindParam ? parseLibraryKind(kindParam) : null;
  if (kindParam && !kind) {
    return NextResponse.json({ error: "Unknown kind." }, { status: 400 });
  }
  try {
    const items = await listLibraryItems({ itemType, kind });
    return NextResponse.json({ items });
  } catch (err) {
    console.error("admin/campaign-library GET", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const itemType = parseLibraryItemType(body.item_type ?? body.type);
  const kind = parseLibraryKind(body.kind) ?? "connector";
  if (!itemType) {
    return NextResponse.json(
      { error: "item_type must be template, sequence, or step." },
      { status: 400 }
    );
  }
  try {
    const item = await createLibraryItem({
      itemType,
      name: typeof body.name === "string" ? body.name : undefined,
      kind,
      createdBy: auth.userId,
    });
    return NextResponse.json({ item });
  } catch (err) {
    console.error("admin/campaign-library POST", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
