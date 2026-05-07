import { Agent } from "undici";

type LinkedInConnection = {
  linkedin_sub: string;
  access_token: string;
};

const linkedInDispatcher = new Agent({
  connect: { timeout: 30_000 },
});

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchLinkedInWithRetry(
  input: string,
  init: RequestInit,
  retries = 2
): Promise<Response> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetch(input, {
        ...init,
        // Undici dispatcher gives us a longer connect timeout than the default.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        dispatcher: linkedInDispatcher,
      } as RequestInit & { dispatcher: unknown });
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await sleep(800 * (attempt + 1));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("LinkedIn fetch failed");
}

async function resolveLinkedInMemberId(accessToken: string): Promise<string | null> {
  const apiVersion = process.env.LINKEDIN_API_VERSION ?? "202405";
  try {
    const meRes = await fetchLinkedInWithRetry(
      "https://api.linkedin.com/v2/me?projection=(id,localizedFirstName,localizedLastName)",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-Restli-Protocol-Version": "2.0.0",
          "LinkedIn-Version": apiVersion,
        },
        cache: "no-store",
      }
    );
    if (!meRes.ok) return null;
    const me = (await meRes.json().catch(() => ({}))) as { id?: string };
    return me.id ?? null;
  } catch {
    return null;
  }
}

export async function publishLinkedInTextPost(
  connection: LinkedInConnection,
  content: string
): Promise<{ ok: true; postUrn: string | null } | { ok: false; error: string }> {
  const apiVersion = process.env.LINKEDIN_API_VERSION ?? "202405";
  const memberId =
    (await resolveLinkedInMemberId(connection.access_token)) ?? connection.linkedin_sub;
  const author = `urn:li:person:${memberId}`;

  try {
    const res = await fetchLinkedInWithRetry("https://api.linkedin.com/rest/posts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${connection.access_token}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
        "LinkedIn-Version": apiVersion,
      },
      body: JSON.stringify({
        author,
        commentary: content,
        visibility: "PUBLIC",
        distribution: {
          feedDistribution: "MAIN_FEED",
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false,
      }),
      cache: "no-store",
    });

    const location = res.headers.get("x-restli-id") ?? res.headers.get("location");
    if (res.ok) {
      return { ok: true, postUrn: location };
    }

    const body = await res.text().catch(() => "");
    return {
      ok: false,
      error: `LinkedIn publish failed (${res.status}): ${body || "Unknown error"} (author=${author})`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown fetch error";
    const cause =
      error &&
      typeof error === "object" &&
      "cause" in error &&
      (error as { cause?: unknown }).cause
        ? String((error as { cause?: unknown }).cause)
        : "";
    return {
      ok: false,
      error: `LinkedIn publish exception: ${message}${cause ? ` | cause: ${cause}` : ""}`,
    };
  }
}
