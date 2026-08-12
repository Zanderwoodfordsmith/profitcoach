/**
 * Minimal Bird platform HTTP client (email + SMS).
 * Auth: Authorization Bearer <bk_… workspace access key>
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export type BirdSendEmailInput = {
  toEmail: string;
  toName?: string | null;
  fromEmail: string;
  fromName: string;
  replyTo?: string | null;
  subject: string;
  text: string;
  html?: string;
  metadata?: Record<string, string>;
};

export type BirdSendSmsInput = {
  to: string;
  from: string;
  text: string;
  metadata?: Record<string, string>;
};

export type BirdSendResult = {
  ok: boolean;
  id?: string;
  status?: string;
  error?: string;
  raw?: unknown;
};

function birdConfig() {
  const apiUrl = (
    process.env.BIRD_API_URL?.trim() || "https://eu1.platform.bird.com"
  ).replace(/\/$/, "");
  const accessKey = process.env.BIRD_ACCESS_KEY?.trim() || "";
  const fromEmail =
    process.env.BIRD_FROM_EMAIL?.trim() || "onboarding@messagebird.dev";
  const fromName = process.env.BIRD_FROM_NAME?.trim() || "Profit Coach";
  const smsFrom = process.env.BIRD_SMS_FROM?.trim() || "";
  return { apiUrl, accessKey, fromEmail, fromName, smsFrom };
}

export function isBirdConfigured(): boolean {
  return Boolean(birdConfig().accessKey);
}

export function getBirdSenderDefaults() {
  const { fromEmail, fromName, smsFrom } = birdConfig();
  return { fromEmail, fromName, smsFrom };
}

async function birdFetch(
  path: string,
  init: RequestInit
): Promise<{ status: number; json: unknown }> {
  const { apiUrl, accessKey } = birdConfig();
  if (!accessKey) {
    return {
      status: 0,
      json: { error: "BIRD_ACCESS_KEY is not configured." },
    };
  }
  const res = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

export async function birdSendEmail(
  input: BirdSendEmailInput
): Promise<BirdSendResult> {
  const body: Record<string, unknown> = {
    category: "transactional",
    from: { email: input.fromEmail, name: input.fromName },
    to: [
      {
        email: input.toEmail,
        ...(input.toName?.trim() ? { name: input.toName.trim() } : {}),
      },
    ],
    subject: input.subject,
    text: input.text,
    ...(input.html ? { html: input.html } : {}),
    ...(input.replyTo?.trim()
      ? { reply_to: [input.replyTo.trim()] }
      : {}),
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };

  const { status, json } = await birdFetch("/v1/email/messages", {
    method: "POST",
    body: JSON.stringify(body),
  });

  const obj = (json || {}) as Record<string, unknown>;
  if (status >= 200 && status < 300) {
    return {
      ok: true,
      id: typeof obj.id === "string" ? obj.id : undefined,
      status: typeof obj.status === "string" ? obj.status : "accepted",
      raw: json,
    };
  }

  const err =
    (obj.error as { message?: string } | undefined)?.message ||
    `Bird email failed (${status})`;
  return { ok: false, error: err, raw: json };
}

export async function birdSendSms(
  input: BirdSendSmsInput
): Promise<BirdSendResult> {
  const body: Record<string, unknown> = {
    category: "transactional",
    from: input.from,
    to: input.to,
    text: input.text,
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };

  const { status, json } = await birdFetch("/v1/sms/messages", {
    method: "POST",
    body: JSON.stringify(body),
  });

  const obj = (json || {}) as Record<string, unknown>;
  if (status >= 200 && status < 300) {
    return {
      ok: true,
      id: typeof obj.id === "string" ? obj.id : undefined,
      status: typeof obj.status === "string" ? obj.status : "accepted",
      raw: json,
    };
  }

  const err =
    (obj.error as { message?: string } | undefined)?.message ||
    `Bird SMS failed (${status})`;
  return { ok: false, error: err, raw: json };
}

/** Best-effort E.164-ish normalize for SMS; returns null if unusable. */
export function normalizePhoneE164(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const cleaned = raw.trim().replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+") && cleaned.length >= 10) return cleaned;
  const digits = cleaned.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 10) return `+${digits}`;
  return null;
}

/** Reply-To that routes prospect replies into Bird on our send subdomain. */
export function conversationReplyToAddress(conversationId: string): string {
  const { fromEmail } = birdConfig();
  const domain = fromEmail.includes("@")
    ? fromEmail.split("@")[1]!
    : "send.theprofitcoach.com";
  const tag = conversationId.replace(/-/g, "").toLowerCase();
  return `reply+${tag}@${domain}`;
}

/** Extract conversation UUID from reply+{uuid32}@domain addressing. */
export function parseConversationIdFromAddress(
  address: string | null | undefined
): string | null {
  if (!address) return null;
  const m = address.toLowerCase().match(/reply\+([0-9a-f]{32})@/);
  if (!m) return null;
  const h = m[1];
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export type BirdInboundMessageMeta = {
  id: string;
  from?: { email?: string; name?: string } | string;
  to?: Array<{ email?: string; name?: string } | string>;
  cc?: Array<{ email?: string; name?: string } | string>;
  subject?: string;
  message_id?: string;
  in_reply_to?: string;
  references?: string[];
  received_at?: string;
  created_at?: string;
  authentication?: string;
};

function emailOf(
  value: { email?: string; name?: string } | string | null | undefined
): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    const m = value.match(/<([^>]+)>/);
    return (m?.[1] || value).trim().toLowerCase() || null;
  }
  return value.email?.trim().toLowerCase() || null;
}

export function birdAddressEmails(
  value:
    | Array<{ email?: string; name?: string } | string>
    | { email?: string; name?: string }
    | string
    | null
    | undefined
): string[] {
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  return list.map(emailOf).filter((e): e is string => Boolean(e));
}

export async function birdGetInboundMessage(
  id: string
): Promise<{ ok: boolean; meta?: BirdInboundMessageMeta; error?: string }> {
  const { status, json } = await birdFetch(
    `/v1/email/inbound-messages/${encodeURIComponent(id)}`,
    { method: "GET" }
  );
  if (status >= 200 && status < 300) {
    return { ok: true, meta: json as BirdInboundMessageMeta };
  }
  const obj = (json || {}) as { error?: { message?: string } };
  return {
    ok: false,
    error: obj.error?.message || `Inbound get failed (${status})`,
  };
}

export async function birdGetInboundBody(
  id: string
): Promise<{ ok: boolean; text?: string; html?: string; error?: string }> {
  const { status, json } = await birdFetch(
    `/v1/email/inbound-messages/${encodeURIComponent(id)}/body`,
    { method: "GET" }
  );
  const obj = (json || {}) as Record<string, unknown>;
  if (status >= 200 && status < 300) {
    return {
      ok: true,
      text: typeof obj.text === "string" ? obj.text : undefined,
      html: typeof obj.html === "string" ? obj.html : undefined,
    };
  }
  return {
    ok: false,
    error:
      (obj.error as { message?: string } | undefined)?.message ||
      `Inbound body failed (${status})`,
  };
}

export async function birdListInboundMessages(limit = 25): Promise<{
  ok: boolean;
  messages: BirdInboundMessageMeta[];
  error?: string;
}> {
  const { status, json } = await birdFetch(
    `/v1/email/inbound-messages?limit=${Math.min(Math.max(limit, 1), 50)}`,
    { method: "GET" }
  );
  const obj = (json || {}) as {
    data?: BirdInboundMessageMeta[];
    error?: { message?: string };
  };
  if (status >= 200 && status < 300) {
    return { ok: true, messages: Array.isArray(obj.data) ? obj.data : [] };
  }
  return {
    ok: false,
    messages: [],
    error: obj.error?.message || `Inbound list failed (${status})`,
  };
}

/** Verify Bird Standard Webhooks signature. */
export function verifyBirdWebhookSignature(args: {
  rawBody: string;
  webhookId: string | null;
  webhookTimestamp: string | null;
  webhookSignature: string | null;
  secret: string;
}): boolean {
  const { rawBody, webhookId, webhookTimestamp, webhookSignature, secret } =
    args;
  if (!webhookId || !webhookTimestamp || !webhookSignature || !secret) {
    return false;
  }
  const ts = Number(webhookTimestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
    return false;
  }
  const keyPart = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  const key = Buffer.from(keyPart, "base64");
  const expected = createHmac("sha256", key)
    .update(`${webhookId}.${webhookTimestamp}.${rawBody}`)
    .digest("base64");
  const expectedBuf = Buffer.from(expected, "base64");
  return webhookSignature.split(" ").some((part) => {
    const sigB64 = part.replace(/^v1,/, "").trim();
    if (!sigB64) return false;
    const sig = Buffer.from(sigB64, "base64");
    return (
      sig.length === expectedBuf.length && timingSafeEqual(sig, expectedBuf)
    );
  });
}
