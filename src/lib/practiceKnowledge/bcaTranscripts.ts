import { memberWebhookTarget, signMemberWebhook } from "@/lib/membership/notifyBcaNewMember";

export type BcaTranscriptCall = {
  id: string;
  callType: string;
  callAt: string | null;
  title: string;
  transcript: string;
};

const FETCH_TIMEOUT_MS = 12_000;

function transcriptsUrl(): string | null {
  const override = process.env.BCA_TRANSCRIPTS_URL?.trim();
  if (override) {
    if (
      override === "https://www.businesscoachacademy.com/api/internal/profit-coach/transcripts" ||
      override === "http://localhost:3003/api/internal/profit-coach/transcripts"
    ) {
      return override;
    }
    return null;
  }
  const member = memberWebhookTarget();
  if (!member) return null;
  return member.replace(
    /\/api\/webhooks\/profit-coach\/member$/,
    "/api/internal/profit-coach/transcripts"
  );
}

export async function fetchBcaSalesTranscripts(input: {
  coachId: string;
  fullName: string;
  email: string | null;
}): Promise<{ calls: BcaTranscriptCall[]; error?: string }> {
  const secret = process.env.BCA_MEMBER_WEBHOOK_SECRET?.trim() ?? "";
  const url = transcriptsUrl();
  if (!secret || !url) {
    return { calls: [], error: "BCA transcripts are not configured." };
  }

  const body: Record<string, string> = {
    pcCoachId: input.coachId.trim().toLowerCase(),
    fullName: input.fullName.trim().slice(0, 120),
    joinedAt: new Date().toISOString(),
  };
  const email = input.email?.trim().toLowerCase() ?? "";
  if (email) body.email = email.slice(0, 200);

  const rawBody = JSON.stringify(body);
  const timestamp = Date.now().toString();
  const signature = signMemberWebhook(secret, timestamp, rawBody);

  try {
    const response = await fetch(url, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        "x-bca-timestamp": timestamp,
        "x-bca-signature": signature,
      },
      body: rawBody,
    });
    if (!response.ok) {
      return { calls: [], error: `BCA returned ${response.status}.` };
    }
    const data = (await response.json().catch(() => null)) as
      | { calls?: BcaTranscriptCall[] }
      | null;
    const calls = Array.isArray(data?.calls)
      ? data.calls.filter(
          (call) =>
            call &&
            typeof call.id === "string" &&
            typeof call.transcript === "string" &&
            call.transcript.trim()
        )
      : [];
    return { calls };
  } catch (error) {
    return {
      calls: [],
      error: error instanceof Error ? error.name : "BCA request failed.",
    };
  }
}

/** Exported for tests that need to assert the path rewrite. */
export function bcaTranscriptsUrlForTest(memberUrl: string): string {
  return memberUrl.replace(
    /\/api\/webhooks\/profit-coach\/member$/,
    "/api/internal/profit-coach/transcripts"
  );
}
