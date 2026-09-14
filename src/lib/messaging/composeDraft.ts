export type MessagingComposeChannel =
  | "email"
  | "sms"
  | "linkedin"
  | "whatsapp"
  | "instagram"
  | "messenger";

export type MessagingComposeDraft = {
  conversationId: string;
  body: string;
  channel?: MessagingComposeChannel;
};

const STORAGE_KEY = "pc:messaging-compose-draft";

export function setMessagingComposeDraft(draft: MessagingComposeDraft): void {
  if (typeof window === "undefined") return;
  const conversationId = draft.conversationId.trim();
  const body = draft.body.trim();
  if (!conversationId || !body) return;
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        conversationId,
        body,
        channel: draft.channel,
      } satisfies MessagingComposeDraft)
    );
  } catch {
    /* private mode / quota */
  }
}

export function peekMessagingComposeDraft(): MessagingComposeDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MessagingComposeDraft;
    if (!parsed?.conversationId || !parsed.body) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function consumeMessagingComposeDraft(
  conversationId?: string
): MessagingComposeDraft | null {
  const draft = peekMessagingComposeDraft();
  if (!draft) return null;
  if (conversationId && draft.conversationId !== conversationId) return null;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  return draft;
}
