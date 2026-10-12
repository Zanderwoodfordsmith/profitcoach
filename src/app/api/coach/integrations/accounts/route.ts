import { NextResponse } from "next/server";
import {
  canAccessCoachResource,
  requireCoachOrAdmin,
  resolveCoachTarget,
} from "@/lib/booking/resolveCoachTarget";
import { requireOutreachCoach } from "@/lib/unipile/requireOutreachCoach";
import {
  createProviderConnectLink,
  listOutreachAccounts,
  parseUnipileConnectReturnTo,
  removeOutreachAccount,
  syncOutreachAccountsForCoach,
} from "@/lib/unipile/outreachAccounts";
import { isUnipileConfigured } from "@/lib/unipile/client";
import { pickMailingReconnectAccountId } from "@/lib/unipile/mailingReconnect";
import {
  isConnectableProvider,
  UNIPILE_CONNECT_PROVIDERS,
  type UnipileConnectProvider,
} from "@/lib/unipile/providers";

/**
 * Coach Settings → Integrations: list, connect, or disconnect Unipile channels.
 */
export async function GET(request: Request) {
  const auth = await requireOutreachCoach(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  try {
    const accounts = await listOutreachAccounts(auth.coachId);
    return NextResponse.json({
      configured: isUnipileConfigured(),
      providers: UNIPILE_CONNECT_PROVIDERS,
      accounts,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list accounts." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireCoachOrAdmin(request);
  if (auth.error || !auth.userId || !auth.role) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    account_id?: string;
    provider?: string;
    returnTo?: string;
    forSlug?: string;
    reconnect?: boolean;
  };

  let target: Awaited<ReturnType<typeof resolveCoachTarget>>;
  try {
    target = await resolveCoachTarget({
      auth: { userId: auth.userId, role: auth.role },
      forSlug: body.forSlug,
      impersonateCoachId: auth.impersonateCoachId,
    });
  } catch {
    return NextResponse.json(
      { error: "Could not set up coach profile." },
      { status: 500 }
    );
  }
  if (!target.ok) {
    return NextResponse.json({ error: target.error }, { status: target.status });
  }
  if (!canAccessCoachResource(auth, target.coach.id)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  const coachId = target.coach.id;

  try {
    if (body.action === "sync") {
      const accounts = await syncOutreachAccountsForCoach(coachId);
      return NextResponse.json({ accounts });
    }
    if (body.action === "disconnect") {
      const accountId = body.account_id?.trim();
      if (!accountId) {
        return NextResponse.json(
          { error: "account_id is required." },
          { status: 400 }
        );
      }
      const accounts = await removeOutreachAccount(coachId, accountId);
      return NextResponse.json({ accounts, ok: true });
    }

    const providerRaw = (body.provider || "").toUpperCase();
    if (!isConnectableProvider(providerRaw)) {
      return NextResponse.json(
        {
          error:
            "provider is required (LINKEDIN, WHATSAPP, INSTAGRAM, MESSENGER, GOOGLE, OUTLOOK).",
        },
        { status: 400 }
      );
    }
    const accounts = await listOutreachAccounts(coachId);
    const reconnectAccountId = pickMailingReconnectAccountId(
      accounts,
      providerRaw,
      { upgradeConnected: body.reconnect === true }
    );
    const { url } = await createProviderConnectLink(
      coachId,
      request,
      providerRaw as UnipileConnectProvider,
      {
        returnTo: parseUnipileConnectReturnTo(body.returnTo),
        reconnectAccountId,
      }
    );
    return NextResponse.json({ url, provider: providerRaw });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Connect failed." },
      { status: 500 }
    );
  }
}
