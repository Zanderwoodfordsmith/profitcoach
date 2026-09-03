import {
  createUnipileWebhook,
  listUnipileWebhooks,
} from "@/lib/unipile/client";
import {
  handleUnipileAccountStatusEvent,
  handleUnipileMailReceived,
  handleUnipileMessageReceived,
  handleUnipileNewRelation,
} from "@/lib/unipile/webhookHandlers";
import { getAppBaseUrl } from "@/lib/appBaseUrl";

const WEBHOOK_NAMES = {
  messaging: "pc-linkedin-messaging",
  users: "pc-linkedin-users",
  account_status: "pc-linkedin-account-status",
  email: "pc-unipile-email",
} as const;

function webhookRequestUrl(base: string) {
  return `${base.replace(/\/$/, "")}/api/unipile/webhooks`;
}

function webhookAuthHeaders(): Array<{ key: string; value: string }> {
  const secret = process.env.UNIPILE_WEBHOOK_SECRET?.trim();
  if (!secret) return [];
  return [{ key: "X-Unipile-Webhook-Secret", value: secret }];
}

/**
 * Ensure messaging / users / account_status / email Unipile webhooks exist (idempotent).
 * Safe to call after account connect or from an admin setup action.
 */
export async function ensureUnipileWebhooksRegistered(
  request?: Request
): Promise<{
  ok: boolean;
  created: string[];
  existing: string[];
  error?: string;
}> {
  const base = getAppBaseUrl(request);
  // Localhost URLs are useless for Unipile cloud callbacks
  if (/localhost|127\.0\.0\.1/.test(base)) {
    return {
      ok: false,
      created: [],
      existing: [],
      error:
        "APP_BASE_URL must be a public HTTPS URL for Unipile webhooks (not localhost).",
    };
  }

  const listed = await listUnipileWebhooks();
  if (!listed.ok) {
    return {
      ok: false,
      created: [],
      existing: [],
      error: listed.error || "Could not list webhooks.",
    };
  }

  const items = listed.data?.items ?? [];
  const byName = new Map(
    items.map((w) => [String(w.name || ""), w] as const)
  );
  const requestUrl = webhookRequestUrl(base);
  const headers = webhookAuthHeaders();
  const created: string[] = [];
  const existing: string[] = [];

  const specs: Array<{
    name: string;
    source: string;
    events: string[];
  }> = [
    {
      name: WEBHOOK_NAMES.messaging,
      source: "messaging",
      events: ["message_received"],
    },
    {
      name: WEBHOOK_NAMES.users,
      source: "users",
      events: ["new_relation"],
    },
    {
      name: WEBHOOK_NAMES.account_status,
      source: "account_status",
      events: [
        "creation_success",
        "reconnected",
        "stopped",
        "ok",
        "error",
        "credentials",
        "permissions",
        "deleted",
      ],
    },
    {
      name: WEBHOOK_NAMES.email,
      source: "email",
      events: ["mail_received", "mail_sent"],
    },
  ];

  for (const spec of specs) {
    if (byName.has(spec.name)) {
      existing.push(spec.name);
      continue;
    }
    const res = await createUnipileWebhook({
      request_url: requestUrl,
      name: spec.name,
      source: spec.source,
      events: spec.events,
      format: "json",
      enabled: true,
      ...(headers.length ? { headers } : {}),
    });
    if (!res.ok) {
      return {
        ok: false,
        created,
        existing,
        error: res.error || `Failed to create ${spec.name}`,
      };
    }
    created.push(spec.name);
  }

  return { ok: true, created, existing };
}

export function verifyUnipileWebhookSecret(request: Request): boolean {
  const secret = process.env.UNIPILE_WEBHOOK_SECRET?.trim();
  if (!secret) return true; // allow if unset (dev); set in production
  const header = request.headers.get("x-unipile-webhook-secret") || "";
  return header === secret;
}

export async function dispatchUnipileWebhookPayload(
  body: Record<string, unknown>
): Promise<{ handled: string; detail?: string }> {
  const event =
    String(body.event || body.Event || "").toLowerCase() ||
    String(body.status || "").toLowerCase();
  const source = String(
    body.source || body.Source || body.AccountStatus || ""
  ).toLowerCase();

  // Hosted-auth style payloads still arrive on notify; messaging uses event names
  if (
    event === "new_relation" ||
    source === "users" ||
    body.user_provider_id ||
    body.user_public_identifier
  ) {
    if (event === "new_relation" || body.user_provider_id) {
      const detail = await handleUnipileNewRelation(body);
      return { handled: "new_relation", detail };
    }
  }

  if (
    event === "mail_received" ||
    event === "mail_sent" ||
    source === "email" ||
    (body.email_id && (body.from_attendee || body.subject))
  ) {
    const detail = await handleUnipileMailReceived(body);
    return { handled: "mail", detail };
  }

  if (
    event === "message_received" ||
    body.message_id ||
    (body.chat_id && body.message)
  ) {
    const detail = await handleUnipileMessageReceived(body);
    return { handled: "message_received", detail };
  }

  if (
    [
      "ok",
      "stopped",
      "error",
      "credentials",
      "permissions",
      "connecting",
      "creation_success",
      "reconnected",
      "deleted",
      "sync_success",
    ].includes(event) ||
    source === "account_status" ||
    body.AccountStatus
  ) {
    const detail = await handleUnipileAccountStatusEvent(body);
    return { handled: "account_status", detail };
  }

  return { handled: "ignored" };
}
