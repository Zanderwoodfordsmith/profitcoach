/**
 * Pure matching rules for support-mailbox mail.
 * Gmail often files a real reply as role=important with only
 * IMPORTANT + CATEGORY_* labels and no INBOX. Those must still attach
 * to an existing ticket. Brand-new archived mail must not open one.
 */

export function isInactiveSupportMailboxEmail(item: {
  role?: unknown;
  folders?: unknown;
}): boolean {
  const role = String(item.role || "").toLowerCase();
  if (
    role === "sent" ||
    role === "drafts" ||
    role === "trash" ||
    role === "archive" ||
    role === "spam"
  ) {
    return true;
  }

  const folders = Array.isArray(item.folders)
    ? item.folders.map((f) => String(f).toLowerCase())
    : [];
  if (
    folders.some(
      (f) =>
        f === "trash" ||
        f === "[gmail]/trash" ||
        f.includes("trash") ||
        f === "archive" ||
        f === "spam" ||
        f === "[gmail]/spam"
    )
  ) {
    return true;
  }

  // Unipile often omits INBOX and only sends UNREAD + CATEGORY_PERSONAL
  // for mail that is still in the inbox. Updates and promotions stay skipped.
  if (
    folders.some((f) => f === "unread") &&
    folders.some((f) => f === "category_personal")
  ) {
    return false;
  }

  // Gmail keeps archived mail with category-only labels (and sometimes
  // role=unknown) — anything with labels but no INBOX is already filed away.
  // Only role=unknown mail with an empty folders list stays processable.
  if (folders.length > 0 && !folders.some((f) => f === "inbox" || f === "inb")) {
    return true;
  }

  return false;
}

/** Strip Re:/Fwd: chains so a reply subject can be compared to a ticket title. */
export function normalizeSupportEmailSubject(subject: string): string {
  return subject
    .replace(/^(?:\s*(?:re|fw|fwd)\s*:\s*)+/i, "")
    .replace(/\s*\(SUP-\d{1,8}\)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * True when this message is likely a reply to mail we already sent,
 * even if Gmail has taken it out of the inbox.
 * A thread id alone is not enough — every Gmail message has one.
 */
export function inboundMightBeSupportFollowUp(item: {
  subject?: unknown;
  in_reply_to?: unknown;
}): boolean {
  const subject = String(item.subject || "");
  if (/\bSUP-\d{1,8}\b/i.test(subject)) return true;
  if (/^\s*(?:re|fw|fwd)\s*:/i.test(subject)) return true;
  return Boolean(item.in_reply_to && typeof item.in_reply_to === "object");
}

/** Skip mailbox sync/webhook work for filed-away mail that is not a reply. */
export function shouldSkipInactiveSupportEmail(item: {
  role?: unknown;
  folders?: unknown;
  subject?: unknown;
  in_reply_to?: unknown;
}): boolean {
  return (
    isInactiveSupportMailboxEmail(item) && !inboundMightBeSupportFollowUp(item)
  );
}
