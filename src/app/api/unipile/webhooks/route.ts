import { NextResponse } from "next/server";
import {
  dispatchUnipileWebhookPayload,
  ensureUnipileWebhooksRegistered,
  verifyUnipileWebhookSecret,
} from "@/lib/unipile/webhooks";
import { requireAdmin } from "@/lib/requireAdmin";

export const maxDuration = 60;

/** Unipile → us: messaging, new_relation, account_status. */
export async function POST(request: Request) {
  if (!verifyUnipileWebhookSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  try {
    const result = await dispatchUnipileWebhookPayload(body);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("unipile webhook:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Webhook failed" },
      { status: 500 }
    );
  }
}

/** Admin: register Unipile webhooks against APP_BASE_URL. */
export async function PUT(request: Request) {
  const admin = await requireAdmin(request);
  if (admin.error) {
    return NextResponse.json({ error: admin.error }, { status: 401 });
  }
  const result = await ensureUnipileWebhooksRegistered(request);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    hint: "POST events from Unipile. PUT (admin) to register webhooks.",
  });
}
