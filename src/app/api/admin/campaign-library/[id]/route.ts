import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import {
  parseLibraryKind,
  parseLibraryStatus,
} from "@/lib/campaignLibrary/sanitize";
import {
  deleteLibraryItem,
  getLibraryItem,
  updateLibraryItem,
} from "@/lib/campaignLibrary/store";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const { id } = await ctx.params;
  try {
    const item = await getLibraryItem(id);
    if (!item) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ item });
  } catch (err) {
    console.error("admin/campaign-library/[id] GET", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const kind = body.kind !== undefined ? parseLibraryKind(body.kind) : undefined;
  if (body.kind !== undefined && !kind) {
    return NextResponse.json({ error: "Unknown kind." }, { status: 400 });
  }
  const status =
    body.status !== undefined ? parseLibraryStatus(body.status) : undefined;
  if (body.status !== undefined && !status) {
    return NextResponse.json({ error: "Unknown status." }, { status: 400 });
  }
  try {
    const item = await updateLibraryItem(id, {
      name: typeof body.name === "string" ? body.name : undefined,
      kind: kind ?? undefined,
      description:
        body.description === null || typeof body.description === "string"
          ? (body.description as string | null)
          : undefined,
      status: status ?? undefined,
      settings: body.settings,
    });
    if (!item) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ item });
  } catch (err) {
    console.error("admin/campaign-library/[id] PATCH", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const { id } = await ctx.params;
  try {
    const ok = await deleteLibraryItem(id);
    if (!ok) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("admin/campaign-library/[id] DELETE", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
