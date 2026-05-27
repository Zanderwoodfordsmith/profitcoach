import { NextResponse } from "next/server";

import { deleteAcademyResource } from "@/lib/academy/resources";
import { requireAdmin } from "@/lib/requireAdmin";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ resourceId: string }> }
) {
  const check = await requireAdmin(request);
  if (check.error) {
    const status = check.error === "Server error." ? 500 : 401;
    return NextResponse.json({ error: check.error }, { status });
  }

  const { resourceId } = await context.params;

  try {
    await deleteAcademyResource(resourceId);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete resource." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
