import { NextResponse } from "next/server";
import { getAllPlaybookSummaries } from "@/lib/playbookContent";

export async function GET() {
  try {
    const summaries = await getAllPlaybookSummaries();
    return NextResponse.json({ playbooks: summaries });
  } catch (e) {
    console.error("Error loading playbook summaries:", e);
    return NextResponse.json(
      { error: "Unable to load playbook summaries." },
      { status: 500 }
    );
  }
}
