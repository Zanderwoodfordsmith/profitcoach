import { NextResponse } from "next/server";
import { isCronRequest } from "@/lib/cronAuth";
import { requireAdmin } from "@/lib/requireAdmin";
import { processOutreachJobsTick } from "@/lib/unipile/worker";

export const maxDuration = 60;

export async function GET(request: Request) {
  const cron = isCronRequest(request);
  if (!cron) {
    const admin = await requireAdmin(request);
    if (admin.error) {
      return NextResponse.json({ error: admin.error }, { status: 401 });
    }
  }
  try {
    const result = await processOutreachJobsTick();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Worker failed." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
