import { canonicalizeProspectStatus } from "@/lib/prospectStatus";

/**
 * Reply disposition types and inference, safe for the browser (the database update stays in replyDisposition.ts).
 */

export const REPLY_DISPOSITIONS = [
  "interested",
  "neutral",
  "not_interested",
] as const;

export type ReplyDisposition = (typeof REPLY_DISPOSITIONS)[number];

export function isReplyDisposition(
  value: string | null | undefined
): value is ReplyDisposition {
  return (
    value === "interested" ||
    value === "neutral" ||
    value === "not_interested"
  );
}

export function dispositionFromInterestOutcome(
  outcome: string | null | undefined
): ReplyDisposition | null {
  const key = (outcome || "").toLowerCase();
  if (key === "positive") return "interested";
  if (key === "soft") return "neutral";
  if (key === "negative") return "not_interested";
  return null;
}

export function inferReplyDisposition(input: {
  replyDisposition?: string | null;
  prospectStatus?: string | null;
  interestOutcome?: string | null;
}): ReplyDisposition | null {
  if (isReplyDisposition(input.replyDisposition)) return input.replyDisposition;
  const fromOutcome = dispositionFromInterestOutcome(input.interestOutcome);
  if (fromOutcome) return fromOutcome;
  const status = canonicalizeProspectStatus(input.prospectStatus);
  if (status === "interested") return "interested";
  if (status === "follow_up") return "neutral";
  if (status === "lost" || status === "abandoned") return "not_interested";
  return null;
}

/** Coach-facing labels. Stored values stay interested / neutral / not_interested. */
export const REPLY_DISPOSITION_LABELS: Record<ReplyDisposition, string> = {
  interested: "Positive",
  neutral: "Neutral",
  not_interested: "Deselect",
};
