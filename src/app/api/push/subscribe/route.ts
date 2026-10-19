import { NextResponse } from "next/server";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { sendPushToUser } from "@/lib/push/webPush";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/** Save this device's push subscription for whoever is signed in (never a coach an admin is viewing as). Body: { subscription, test? }. */
export async function POST(request: Request) {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error || !auth.userId) return NextResponse.json({ error: auth.error ?? "Not authorised." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as {
    subscription?: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
    test?: unknown;
  };
  const sub = body.subscription;
  const endpoint = typeof sub?.endpoint === "string" ? sub.endpoint : "";
  const p256dh = typeof sub?.keys?.p256dh === "string" ? sub.keys.p256dh : "";
  const authKey = typeof sub?.keys?.auth === "string" ? sub.keys.auth : "";
  if (!/^https:\/\//.test(endpoint) || endpoint.length > 1000 || !p256dh || !authKey || p256dh.length > 200 || authKey.length > 100) {
    return NextResponse.json({ error: "That subscription doesn't look right." }, { status: 400 });
  }
  const { error } = await supabaseAdmin.from("web_push_subscriptions").upsert(
    {
      user_id: auth.callerId,
      endpoint,
      p256dh,
      auth: authKey,
      user_agent: (request.headers.get("user-agent") || "").slice(0, 300),
      failed_count: 0,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  );
  if (error) return NextResponse.json({ error: "Could not save alerts for this device." }, { status: 500 });
  let delivered = 0;
  if (body.test === true) {
    delivered = await sendPushToUser(auth.callerId, {
      title: "Alerts are on",
      body: "Ava will tell you here the moment a prospect replies.",
      url: "/coach/settings",
      tag: "push-test",
    });
  }
  return NextResponse.json({ ok: true, delivered });
}

/** Body: { endpoint } — stop alerts on this device. */
export async function DELETE(request: Request) {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error || !auth.userId) return NextResponse.json({ error: auth.error ?? "Not authorised." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { endpoint?: unknown };
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  if (!endpoint) return NextResponse.json({ error: "Missing device." }, { status: 400 });
  await supabaseAdmin.from("web_push_subscriptions").delete().eq("user_id", auth.callerId).eq("endpoint", endpoint);
  return NextResponse.json({ ok: true });
}
