import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Web push to a user's installed app / browsers. Subscriptions that the push
 * service says are gone (404/410) are deleted; others count failures.
 */

export type PushPayload = { title: string; body: string; url?: string; tag?: string };

let configured: boolean | null = null;

export function isWebPushConfigured(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY?.trim();
  const priv = process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.WEB_PUSH_SUBJECT?.trim() || "mailto:support@businesscoachacademy.com";
  if (!pub || !priv) {
    configured = false;
    return false;
  }
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!isWebPushConfigured()) return 0;
  const { data: subs } = await supabaseAdmin
    .from("web_push_subscriptions")
    .select("id, endpoint, p256dh, auth, failed_count")
    .eq("user_id", userId);
  let delivered = 0;
  const body = JSON.stringify({
    title: payload.title.slice(0, 120),
    body: payload.body.slice(0, 400),
    url: payload.url ?? "/coach/conversations",
    tag: payload.tag,
  });
  for (const sub of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint as string, keys: { p256dh: sub.p256dh as string, auth: sub.auth as string } },
        body,
        { TTL: 60 * 60 * 12, urgency: "high" }
      );
      delivered += 1;
      await supabaseAdmin
        .from("web_push_subscriptions")
        .update({ failed_count: 0, last_success_at: new Date().toISOString() })
        .eq("id", sub.id);
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await supabaseAdmin.from("web_push_subscriptions").delete().eq("id", sub.id);
      } else {
        console.error("web push:", status ?? (err instanceof Error ? err.message : err));
        await supabaseAdmin
          .from("web_push_subscriptions")
          .update({ failed_count: Number(sub.failed_count ?? 0) + 1 })
          .eq("id", sub.id);
      }
    }
  }
  return delivered;
}
