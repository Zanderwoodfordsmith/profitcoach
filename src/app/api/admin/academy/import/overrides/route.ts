import { NextResponse } from "next/server";

import {
  deleteAcademyImportOverride,
  loadAcademyImportOverrides,
  upsertAcademyImportOverride,
} from "@/lib/academy/academyImportOverrides";
import { requireAdmin } from "@/lib/requireAdmin";

type UpsertBody = {
  relativePath: string;
  courseId: string;
  lessonId: string;
  lessonTitle?: string | null;
};

type DeleteBody = {
  relativePath: string;
};

export async function GET(request: Request) {
  const check = await requireAdmin(request);
  if (check.error) {
    const status = check.error === "Server error." ? 500 : 401;
    return NextResponse.json({ error: check.error }, { status });
  }

  try {
    const overrides = await loadAcademyImportOverrides();
    return NextResponse.json({ overrides });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load overrides." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const check = await requireAdmin(request);
  if (check.error) {
    const status = check.error === "Server error." ? 500 : 401;
    return NextResponse.json({ error: check.error }, { status });
  }

  const body = (await request.json()) as UpsertBody;
  if (!body.relativePath?.trim() || !body.courseId?.trim() || !body.lessonId?.trim()) {
    return NextResponse.json(
      { error: "relativePath, courseId, and lessonId are required." },
      { status: 400 }
    );
  }

  try {
    const override = await upsertAcademyImportOverride(body);
    return NextResponse.json({ override });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save override." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const check = await requireAdmin(request);
  if (check.error) {
    const status = check.error === "Server error." ? 500 : 401;
    return NextResponse.json({ error: check.error }, { status });
  }

  const body = (await request.json()) as DeleteBody;
  if (!body.relativePath?.trim()) {
    return NextResponse.json({ error: "relativePath is required." }, { status: 400 });
  }

  try {
    await deleteAcademyImportOverride(body.relativePath);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete override." },
      { status: 500 }
    );
  }
}
