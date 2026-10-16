import { getAppBaseUrl } from "@/lib/appBaseUrl";
import {
  createHostedAuthLink,
  getUnipileDsn,
  isUnipileConfigured,
  isUnipileWorkspaceApiKeyError,
  UNIPILE_WORKSPACE_API_KEY_ERROR,
} from "@/lib/unipile/client";
import {
  isConnectableProvider,
  type UnipileConnectProvider,
} from "@/lib/unipile/providers";
import { hostedAuthMailCalendarScopes } from "@/lib/unipile/hostedAuthScopes";

export type UnipileConnectReturnTo =
  | "settings"
  | "campaigns"
  | "lead-finder"
  | "calls"
  | "support"
  | "practice";

export function parseUnipileConnectReturnTo(
  raw: unknown
): UnipileConnectReturnTo {
  if (
    raw === "campaigns" ||
    raw === "lead-finder" ||
    raw === "calls" ||
    raw === "support" ||
    raw === "practice" ||
    raw === "settings"
  ) {
    return raw;
  }
  return "settings";
}

/** Send a Gmail or Outlook connect back to Practice Setup, including an admin blueprint tab. */
function practiceSetupReturn(request: Request, flag: string): string {
  const referer = request.headers.get("referer") || "";
  try {
    const url = new URL(referer);
    const onCoachSetup =
      url.pathname.startsWith("/coach/blueprint/setup") ||
      url.pathname.startsWith("/coach/practice/setup");
    const onAdminSetup =
      url.pathname.startsWith("/admin/coaches/") && url.searchParams.get("doc") === "setup";
    if (onCoachSetup || onAdminSetup) {
      url.searchParams.set("connected", flag);
      const query = url.searchParams.toString();
      return query ? `${url.pathname}?${query}` : url.pathname;
    }
  } catch {
    /* use the coach setup path */
  }
  const prefix = settingsReturnPrefix(request);
  if (prefix === "/coach") return `/coach/blueprint/setup?connected=${flag}`;
  return `${prefix}/account?tab=profile&connected=${flag}`;
}

function settingsReturnPrefix(request: Request): "/coach" | "/admin" {
  const referer = request.headers.get("referer") || "";
  if (referer.includes("/coach/") || referer.includes("/coach?")) return "/coach";
  return "/admin";
}

/** Hosted auth link for Unipile providers (Google, LinkedIn, …). */
export async function createProviderConnectLink(
  coachId: string,
  request: Request,
  provider: UnipileConnectProvider,
  options?: {
    returnTo?: UnipileConnectReturnTo;
    reconnectAccountId?: string | null;
  }
): Promise<{ url: string }> {
  if (!isUnipileConfigured()) {
    throw new Error("Unipile is not configured (UNIPILE_DSN / UNIPILE_API_KEY).");
  }
  if (!isConnectableProvider(provider)) {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  const base = getAppBaseUrl(request);
  const dsn = getUnipileDsn();
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const returnPrefix = settingsReturnPrefix(request);
  const returnTo = options?.returnTo ?? "settings";
  const reconnectAccountId = options?.reconnectAccountId?.trim() || "";
  const successPath =
    returnTo === "campaigns"
      ? `${returnPrefix}/campaigns?linkedin=connected`
      : returnTo === "lead-finder"
        ? "/admin/lead-finder?linkedin=connected"
      : returnTo === "calls"
        ? `${returnPrefix}/calls?tab=settings&connected=${provider}`
      : returnTo === "support"
        ? `/admin/support?tab=settings&connected=${provider}`
      : returnTo === "practice"
        ? practiceSetupReturn(request, provider)
      : returnPrefix === "/coach"
        ? `${returnPrefix}/settings?tab=profile&connected=${provider}`
        : `${returnPrefix}/account?tab=profile&connected=${provider}`;
  const failurePath =
    returnTo === "campaigns"
      ? `${returnPrefix}/campaigns?linkedin=failed`
      : returnTo === "lead-finder"
        ? "/admin/lead-finder?linkedin=failed"
      : returnTo === "calls"
        ? `${returnPrefix}/calls?tab=settings&connected=failed`
      : returnTo === "support"
        ? "/admin/support?tab=settings&connected=failed"
      : returnTo === "practice"
        ? practiceSetupReturn(request, "failed")
      : returnPrefix === "/coach"
        ? `${returnPrefix}/settings?tab=profile&connected=failed`
        : `${returnPrefix}/account?tab=profile&connected=failed`;

  const hosted = await createHostedAuthLink({
    type: reconnectAccountId ? "reconnect" : "create",
    apiUrl: dsn,
    expiresOn: expires,
    providers: [provider],
    name: coachId,
    success_redirect_url: `${base}${successPath}`,
    failure_redirect_url: `${base}${failurePath}`,
    notify_url: `${base}/api/unipile/notify`,
    bypass_success_screen: true,
    ...hostedAuthMailCalendarScopes(provider),
    ...(reconnectAccountId ? { reconnect_account: reconnectAccountId } : {}),
  });

  const hostedUrl = hosted.ok ? hosted.data?.url : undefined;
  if (hostedUrl) {
    return { url: hostedUrl };
  }

  console.error("unipile hosted auth failed:", {
    status: hosted.status,
    error: hosted.error,
    type: (hosted.raw as { type?: string } | undefined)?.type,
    provider,
  });
  throw new Error(
    isUnipileWorkspaceApiKeyError(hosted)
      ? UNIPILE_WORKSPACE_API_KEY_ERROR
      : hosted.error || `Could not start ${provider} sign-in.`
  );
}

/** @deprecated Prefer createProviderConnectLink — kept for LinkedIn campaign UIs. */
export async function createLinkedInConnectLink(
  coachId: string,
  request: Request
): Promise<{ url: string }> {
  return createProviderConnectLink(coachId, request, "LINKEDIN", {
    returnTo: "campaigns",
  });
}
