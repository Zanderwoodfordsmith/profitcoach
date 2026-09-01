import { NextResponse } from "next/server";

import { deleteUnmatchedImportFile } from "@/lib/academy/academyImportSnapshot";
import { requireAdmin } from "@/lib/requireAdmin";

type DeleteBody = {
  relativePath?: unknown;
};

export async function DELETE(request: Request) {
  const check = await requireAdmin(request);
  if (check.error) {
    const status = check.error === "Server error." ? 500 : 401;
    return NextResponse.json({ error: check.error }, { status });
  }

  const body = (await request.json().catch(() => ({}))) as DeleteBody;
  if (typeof body.relativePath !== "string" || !body.relativePath.trim()) {
    return NextResponse.json({ error: "relativePath is required." }, { status: 400 });
  }

  try {
    const result = await deleteUnmatchedImportFile(body.relativePath);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete unmatched file." },
      { status: 400 }
    );
  }
}
