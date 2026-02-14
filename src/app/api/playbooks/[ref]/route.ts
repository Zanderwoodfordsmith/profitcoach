import { NextResponse } from "next/server";
import { loadPlaybookContentWithDb } from "@/lib/playbookContent";

type RouteContext = {
  params: Promise<{ ref: string }>;
};

export async function GET(
  _request: Request,
  context: RouteContext
) {
  const { ref } = await context.params;
  const content = await loadPlaybookContentWithDb(ref);

  if (!content) {
    return NextResponse.json(
      { error: "Playbook not found" },
      { status: 404 }
    );
  }

  return NextResponse.json(content);
}
