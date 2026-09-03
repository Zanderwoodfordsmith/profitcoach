/**
 * Minimal Unipile HTTP client (LinkedIn outreach).
 * Auth: X-API-KEY from env. Base URL from UNIPILE_DSN.
 */

export type UnipileResult<T> = {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  raw?: unknown;
};

function unipileConfig() {
  const dsn = (
    process.env.UNIPILE_DSN?.trim() ||
    process.env.UNIPILE_API_URL?.trim() ||
    ""
  ).replace(/\/$/, "");
  const apiKey = process.env.UNIPILE_API_KEY?.trim() || "";
  return { dsn, apiKey };
}

export function isUnipileConfigured(): boolean {
  const { dsn, apiKey } = unipileConfig();
  return Boolean(dsn && apiKey);
}

async function unipileFetch<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<UnipileResult<T>> {
  const { dsn, apiKey } = unipileConfig();
  if (!dsn || !apiKey) {
    return { ok: false, status: 0, error: "Unipile is not configured." };
  }

  const url = `${dsn}${path.startsWith("/") ? path : `/${path}`}`;
  try {
    const res = await fetch(url, {
      method,
      headers: {
        "X-API-KEY": apiKey,
        accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let raw: unknown = null;
    try {
      raw = text ? JSON.parse(text) : null;
    } catch {
      raw = text;
    }
    if (!res.ok) {
      const errObj = raw as { detail?: string; title?: string; type?: string } | null;
      const error =
        errObj?.detail ||
        errObj?.title ||
        errObj?.type ||
        (typeof text === "string" && text.slice(0, 200)) ||
        `Unipile HTTP ${res.status}`;
      return { ok: false, status: res.status, error, raw };
    }
    return { ok: true, status: res.status, data: raw as T, raw };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : "Unipile request failed.",
    };
  }
}

async function unipileFormFetch<T>(
  path: string,
  form: FormData
): Promise<UnipileResult<T>> {
  const { dsn, apiKey } = unipileConfig();
  if (!dsn || !apiKey) {
    return { ok: false, status: 0, error: "Unipile is not configured." };
  }
  const url = `${dsn}${path.startsWith("/") ? path : `/${path}`}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        accept: "application/json",
      },
      body: form,
    });
    const text = await res.text();
    let raw: unknown = null;
    try {
      raw = text ? JSON.parse(text) : null;
    } catch {
      raw = text;
    }
    if (!res.ok) {
      const errObj = raw as { detail?: string; title?: string; type?: string } | null;
      const error =
        errObj?.detail ||
        errObj?.title ||
        errObj?.type ||
        (typeof text === "string" && text.slice(0, 200)) ||
        `Unipile HTTP ${res.status}`;
      return { ok: false, status: res.status, error, raw };
    }
    return { ok: true, status: res.status, data: raw as T, raw };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : "Unipile request failed.",
    };
  }
}

export type UnipileAccount = {
  id: string;
  type?: string;
  name?: string;
  connection_status?: string;
  sources?: Array<{ status?: string }>;
  [key: string]: unknown;
};

export async function listUnipileAccounts() {
  return unipileFetch<{ object?: string; items?: UnipileAccount[] }>(
    "GET",
    "/api/v1/accounts"
  );
}

export async function getUnipileAccount(accountId: string) {
  return unipileFetch<UnipileAccount>(
    "GET",
    `/api/v1/accounts/${encodeURIComponent(accountId)}`
  );
}

export async function createHostedAuthLink(input: {
  type: "create" | "reconnect";
  apiUrl: string;
  expiresOn: string;
  providers?: string[] | string;
  name?: string;
  success_redirect_url?: string;
  failure_redirect_url?: string;
  notify_url?: string;
  reconnect_account?: string;
  bypass_success_screen?: boolean;
}) {
  const body: Record<string, unknown> = {
    type: input.type,
    api_url: input.apiUrl,
    expiresOn: input.expiresOn,
    providers: input.providers ?? ["LINKEDIN"],
  };
  if (input.name) body.name = input.name;
  if (input.success_redirect_url)
    body.success_redirect_url = input.success_redirect_url;
  if (input.failure_redirect_url)
    body.failure_redirect_url = input.failure_redirect_url;
  if (input.notify_url) body.notify_url = input.notify_url;
  if (input.reconnect_account) body.reconnect_account = input.reconnect_account;
  if (input.bypass_success_screen != null)
    body.bypass_success_screen = input.bypass_success_screen;

  return unipileFetch<{ object: string; url: string }>(
    "POST",
    "/api/v1/hosted/accounts/link",
    body
  );
}

export async function resolveUnipileUser(
  identifier: string,
  accountId: string
) {
  const qs = new URLSearchParams({ account_id: accountId });
  return unipileFetch<Record<string, unknown>>(
    "GET",
    `/api/v1/users/${encodeURIComponent(identifier)}?${qs.toString()}`
  );
}

export async function sendUnipileInvitation(input: {
  account_id: string;
  provider_id: string;
  message?: string;
}) {
  return unipileFetch<{ object: string; invitation_id: string }>(
    "POST",
    "/api/v1/users/invite",
    {
      account_id: input.account_id,
      provider_id: input.provider_id,
      ...(input.message ? { message: input.message.slice(0, 300) } : {}),
    }
  );
}

export async function startUnipileChat(input: {
  account_id: string;
  attendees_ids: string[];
  text: string;
}) {
  return unipileFetch<{ object?: string; chat_id?: string; message_id?: string }>(
    "POST",
    "/api/v1/chats",
    {
      account_id: input.account_id,
      attendees_ids: input.attendees_ids,
      text: input.text,
    }
  );
}

export async function sendUnipileChatMessage(input: {
  chat_id: string;
  text?: string;
  account_id?: string;
  attachments?: Array<{ blob: Blob; filename: string }>;
  voice_message?: { blob: Blob; filename: string };
  video_message?: { blob: Blob; filename: string };
}) {
  const hasFiles =
    (input.attachments?.length ?? 0) > 0 ||
    Boolean(input.voice_message) ||
    Boolean(input.video_message);
  const text = (input.text ?? "").trim();

  // Multipart when attaching media; JSON is fine for text-only.
  if (!hasFiles) {
    return unipileFetch<{ object?: string; message_id?: string }>(
      "POST",
      `/api/v1/chats/${encodeURIComponent(input.chat_id)}/messages`,
      {
        text,
        ...(input.account_id ? { account_id: input.account_id } : {}),
      }
    );
  }

  const form = new FormData();
  if (text) form.append("text", text);
  if (input.account_id) form.append("account_id", input.account_id);
  for (const file of input.attachments ?? []) {
    form.append("attachments", file.blob, file.filename);
  }
  if (input.voice_message) {
    form.append(
      "voice_message",
      input.voice_message.blob,
      input.voice_message.filename
    );
  }
  if (input.video_message) {
    form.append(
      "video_message",
      input.video_message.blob,
      input.video_message.filename
    );
  }
  return unipileFormFetch<{ object?: string; message_id?: string }>(
    `/api/v1/chats/${encodeURIComponent(input.chat_id)}/messages`,
    form
  );
}

export async function listUnipileChats(input: {
  account_id: string;
  limit?: number;
  cursor?: string | null;
}) {
  const qs = new URLSearchParams({
    account_id: input.account_id,
    limit: String(input.limit ?? 50),
  });
  if (input.cursor) qs.set("cursor", input.cursor);
  return unipileFetch<{
    object?: string;
    items?: Array<Record<string, unknown>>;
    cursor?: string | null;
  }>("GET", `/api/v1/chats?${qs.toString()}`);
}

export async function listUnipileAttendees(input: {
  account_id: string;
  limit?: number;
  cursor?: string | null;
}) {
  const qs = new URLSearchParams({
    account_id: input.account_id,
    limit: String(input.limit ?? 250),
  });
  if (input.cursor) qs.set("cursor", input.cursor);
  return unipileFetch<{
    object?: string;
    items?: Array<Record<string, unknown>>;
    cursor?: string | null;
  }>("GET", `/api/v1/chat_attendees?${qs.toString()}`);
}

export async function listUnipileChatAttendees(input: {
  chat_id: string;
  limit?: number;
}) {
  const qs = new URLSearchParams({
    limit: String(input.limit ?? 20),
  });
  return unipileFetch<{
    object?: string;
    items?: Array<Record<string, unknown>>;
    cursor?: string | null;
  }>(
    "GET",
    `/api/v1/chats/${encodeURIComponent(input.chat_id)}/attendees?${qs.toString()}`
  );
}

export async function listUnipileChatMessages(input: {
  chat_id: string;
  limit?: number;
  cursor?: string | null;
}) {
  const qs = new URLSearchParams({
    limit: String(input.limit ?? 50),
  });
  if (input.cursor) qs.set("cursor", input.cursor);
  return unipileFetch<{
    object?: string;
    items?: Array<Record<string, unknown>>;
    cursor?: string | null;
  }>(
    "GET",
    `/api/v1/chats/${encodeURIComponent(input.chat_id)}/messages?${qs.toString()}`
  );
}

export async function deleteUnipileAccount(accountId: string) {
  return unipileFetch<{ object?: string }>(
    "DELETE",
    `/api/v1/accounts/${encodeURIComponent(accountId)}`
  );
}

export type UnipileSentInvitation = {
  object?: string;
  id: string;
  invited_user?: string | null;
  invited_user_id?: string | null;
  invited_user_public_id?: string | null;
  invited_user_description?: string | null;
  date?: string;
  parsed_datetime?: string | null;
  invitation_text?: string | null;
};

export async function listSentInvitations(input: {
  account_id: string;
  limit?: number;
  cursor?: string | null;
}) {
  const qs = new URLSearchParams({
    account_id: input.account_id,
    limit: String(input.limit ?? 100),
  });
  if (input.cursor) qs.set("cursor", input.cursor);
  return unipileFetch<{
    object?: string;
    items?: UnipileSentInvitation[];
    cursor?: string | null;
  }>("GET", `/api/v1/users/invite/sent?${qs.toString()}`);
}

export async function cancelSentInvitation(input: {
  account_id: string;
  invitation_id: string;
}) {
  const qs = new URLSearchParams({ account_id: input.account_id });
  return unipileFetch<{ object?: string }>(
    "DELETE",
    `/api/v1/users/invite/sent/${encodeURIComponent(input.invitation_id)}?${qs.toString()}`
  );
}

/** Publish a LinkedIn (or other) post via Unipile multipart API. */
export async function createUnipilePost(input: {
  account_id: string;
  text: string;
  attachments?: Array<{ blob: Blob; filename: string }>;
  external_link?: string | null;
  as_organization?: string | null;
  mentions?: Array<{ name: string; profile_id: string; is_company?: boolean }>;
  repost?: string | null;
}) {
  const form = new FormData();
  form.append("account_id", input.account_id);
  form.append("text", input.text);
  if (input.external_link) form.append("external_link", input.external_link);
  if (input.as_organization)
    form.append("as_organization", input.as_organization);
  if (input.repost) form.append("repost", input.repost);
  if (input.mentions?.length) {
    form.append("mentions", JSON.stringify(input.mentions));
  }
  for (const file of input.attachments ?? []) {
    form.append("attachments", file.blob, file.filename);
  }
  return unipileFormFetch<{ object?: string; post_id?: string | null }>(
    "/api/v1/posts",
    form
  );
}

export async function getUnipilePost(postId: string, accountId: string) {
  const qs = new URLSearchParams({ account_id: accountId });
  return unipileFetch<Record<string, unknown>>(
    "GET",
    `/api/v1/posts/${encodeURIComponent(postId)}?${qs.toString()}`
  );
}

export async function listUnipilePostComments(input: {
  post_id: string;
  account_id: string;
  limit?: number;
  cursor?: string | null;
}) {
  const qs = new URLSearchParams({
    account_id: input.account_id,
    limit: String(input.limit ?? 50),
  });
  if (input.cursor) qs.set("cursor", input.cursor);
  return unipileFetch<{
    object?: string;
    items?: Array<Record<string, unknown>>;
    cursor?: string | null;
  }>(
    "GET",
    `/api/v1/posts/${encodeURIComponent(input.post_id)}/comments?${qs.toString()}`
  );
}

export async function listUnipilePostReactions(input: {
  post_id: string;
  account_id: string;
  limit?: number;
  cursor?: string | null;
}) {
  const qs = new URLSearchParams({
    account_id: input.account_id,
    limit: String(input.limit ?? 50),
  });
  if (input.cursor) qs.set("cursor", input.cursor);
  return unipileFetch<{
    object?: string;
    items?: Array<Record<string, unknown>>;
    cursor?: string | null;
  }>(
    "GET",
    `/api/v1/posts/${encodeURIComponent(input.post_id)}/reactions?${qs.toString()}`
  );
}

export async function commentUnipilePost(input: {
  post_id: string;
  account_id: string;
  text: string;
}) {
  return unipileFetch<{ object?: string; comment_id?: string }>(
    "POST",
    `/api/v1/posts/${encodeURIComponent(input.post_id)}/comments`,
    {
      account_id: input.account_id,
      text: input.text,
    }
  );
}

export async function reactUnipilePost(input: {
  account_id: string;
  post_id: string;
  reaction_type?: string;
}) {
  return unipileFetch<{ object?: string }>("POST", "/api/v1/posts/reaction", {
    account_id: input.account_id,
    post_id: input.post_id,
    reaction_type: input.reaction_type ?? "like",
  });
}

export async function listUnipileWebhooks() {
  return unipileFetch<{
    object?: string;
    items?: Array<Record<string, unknown>>;
  }>("GET", "/api/v1/webhooks?limit=100");
}

export async function createUnipileWebhook(body: Record<string, unknown>) {
  return unipileFetch<{ object?: string; webhook_id?: string }>(
    "POST",
    "/api/v1/webhooks",
    body
  );
}

export async function deleteUnipileWebhook(id: string) {
  return unipileFetch<{ object?: string }>(
    "DELETE",
    `/api/v1/webhooks/${encodeURIComponent(id)}`
  );
}

export async function syncUnipileChatHistory(chatId: string) {
  return unipileFetch<Record<string, unknown>>(
    "GET",
    `/api/v1/chats/${encodeURIComponent(chatId)}/sync`
  );
}

export async function syncUnipileAccountMessaging(accountId: string) {
  return unipileFetch<Record<string, unknown>>(
    "GET",
    `/api/v1/accounts/${encodeURIComponent(accountId)}/sync`
  );
}

export async function listUnipileUserPosts(input: {
  identifier: string;
  account_id: string;
  limit?: number;
  cursor?: string | null;
}) {
  const qs = new URLSearchParams({
    account_id: input.account_id,
    limit: String(input.limit ?? 10),
  });
  if (input.cursor) qs.set("cursor", input.cursor);
  return unipileFetch<{
    object?: string;
    items?: Array<Record<string, unknown>>;
    cursor?: string | null;
  }>(
    "GET",
    `/api/v1/users/${encodeURIComponent(input.identifier)}/posts?${qs.toString()}`
  );
}

export async function linkedInSearch(input: {
  account_id: string;
  cursor?: string | null;
  url?: string;
  api?: string;
  category?: string;
  keywords?: string;
  limit?: number;
  [key: string]: unknown;
}) {
  const { account_id, cursor, limit, ...rest } = input;
  const qs = new URLSearchParams({ account_id });
  if (cursor) qs.set("cursor", String(cursor));
  if (typeof limit === "number" && Number.isFinite(limit)) {
    qs.set("limit", String(Math.min(100, Math.max(1, Math.floor(limit)))));
  }
  const body: Record<string, unknown> = { ...rest };
  delete body.account_id;
  delete body.cursor;
  delete body.limit;
  return unipileFetch<{
    object?: string;
    items?: Array<Record<string, unknown>>;
    cursor?: string | null;
    next_cursor?: string | null;
    paging?: {
      cursor?: string | null;
      start?: number | null;
      page_count?: number;
      total_count?: number | null;
    };
  }>("POST", `/api/v1/linkedin/search?${qs.toString()}`, body);
}

export async function listUnipileEmails(input: {
  account_id: string;
  limit?: number;
  cursor?: string | null;
  meta_only?: boolean;
}) {
  const qs = new URLSearchParams({
    account_id: input.account_id,
    limit: String(input.limit ?? 40),
  });
  if (input.cursor) qs.set("cursor", input.cursor);
  if (input.meta_only != null) qs.set("meta_only", String(input.meta_only));
  return unipileFetch<{
    object?: string;
    items?: Array<Record<string, unknown>>;
    cursor?: string | null;
  }>("GET", `/api/v1/emails?${qs.toString()}`);
}

export async function sendUnipileEmail(input: {
  account_id: string;
  to: Array<{ identifier: string; display_name?: string }>;
  subject?: string;
  body: string;
  reply_to?: string;
}) {
  const form = new FormData();
  form.append("account_id", input.account_id);
  form.append("body", input.body);
  form.append("to", JSON.stringify(input.to));
  if (input.subject) form.append("subject", input.subject);
  if (input.reply_to) form.append("reply_to", input.reply_to);
  return unipileFormFetch<{
    object?: string;
    tracking_id?: string;
    provider_id?: string | null;
  }>("/api/v1/emails", form);
}
