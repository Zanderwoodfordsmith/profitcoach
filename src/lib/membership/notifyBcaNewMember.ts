/**
 * Tell the BCA website when a new member account is created.
 * Signed JSON, same checks as BCA `POST /api/webhooks/profit-coach/member`.
 * A failed send does not undo the new account.
 */

import { createHmac } from "node:crypto";

import { isSystemCoachSlug } from "@/lib/primaryCoach";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const DEFAULT_URL =
  "https://www.businesscoachacademy.com/api/webhooks/profit-coach/member";

const ALLOWED_URLS = new Set([
  DEFAULT_URL,
  "http://localhost:3003/api/webhooks/profit-coach/member",
]);

const SEND_TIMEOUT_MS = 4000;

export function memberWebhookTarget(): string | null {
  const configured = process.env.BCA_MEMBER_WEBHOOK_URL?.trim() || DEFAULT_URL;
  if (!ALLOWED_URLS.has(configured)) return null;
  return configured;
}

export function signMemberWebhook(
  secret: string,
  timestamp: string,
  rawBody: string
): string {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
}

/** Only the fields the BCA receiver accepts. Extra keys are rejected there. */
export function buildInboundMemberBody(input: {
  pcCoachId: string;
  fullName: string;
  email: string | null;
  slug: string | null;
  joinedAt: string;
}): string {
  const body: Record<string, string> = {
    pcCoachId: input.pcCoachId.trim().toLowerCase(),
    fullName: input.fullName.trim().slice(0, 120),
    joinedAt: input.joinedAt,
  };
  const email = input.email?.trim().toLowerCase() ?? "";
  if (email) body.email = email.slice(0, 200);
  const slug = input.slug?.trim().toLowerCase() ?? "";
  if (/^[a-z0-9-]{1,80}$/.test(slug)) body.slug = slug;
  return JSON.stringify(body);
}

export async function notifyBcaNewMember(coachId: string): Promise<void> {
  const secret = process.env.BCA_MEMBER_WEBHOOK_SECRET?.trim() ?? "";
  const url = memberWebhookTarget();
  if (!secret || !url) {
    console.warn("[bca-member] webhook not configured");
    return;
  }

  try {
    const { data: coach, error: coachError } = await supabaseAdmin
      .from("coaches")
      .select("slug")
      .eq("id", coachId)
      .maybeSingle();
    if (coachError) {
      console.warn("[bca-member] coach lookup failed");
      return;
    }
    const slug = (coach?.slug as string | null)?.trim() || null;
    if (isSystemCoachSlug(slug)) return;

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", coachId)
      .maybeSingle();
    if (profileError) {
      console.warn("[bca-member] profile lookup failed");
      return;
    }
    const fullName = (profile?.full_name as string | null)?.trim() ?? "";
    if (!fullName) return;

    const { data: userData, error: userError } =
      await supabaseAdmin.auth.admin.getUserById(coachId);
    const email = userError ? null : userData.user?.email ?? null;

    const rawBody = buildInboundMemberBody({
      pcCoachId: coachId,
      fullName,
      email,
      slug,
      joinedAt: new Date().toISOString(),
    });
    const timestamp = Date.now().toString();
    const signature = signMemberWebhook(secret, timestamp, rawBody);

    const response = await fetch(url, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        "x-bca-timestamp": timestamp,
        "x-bca-signature": signature,
      },
      body: rawBody,
    });
    if (!response.ok) {
      console.warn("[bca-member] webhook failed", response.status);
    }
  } catch (error) {
    console.warn(
      "[bca-member] webhook error",
      error instanceof Error ? error.name : "error"
    );
  }
}
