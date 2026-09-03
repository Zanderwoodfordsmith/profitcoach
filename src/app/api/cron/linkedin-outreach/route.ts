import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { processOutreachJobsTick } from "@/lib/unipile/worker";

export const maxDuration = 60;

function isCronRequest(request: Request): boolean {
  if (request.headers.get("x-vercel-cron") === "1") return true;
  const auth = request.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const secrets = [
    process.env.CRON_SECRET?.trim(),
    process.env.LINKEDIN_CRON_SECRET?.trim(),
  ].filter(Boolean) as string[];
  return !!bearer && secrets.includes(bearer);
}

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
