import { NextResponse } from "next/server";
import { requireOutreachCoach } from "@/lib/unipile/requireOutreachCoach";
import {
  createProviderConnectLink,
  listOutreachAccounts,
  parseUnipileConnectReturnTo,
  removeOutreachAccount,
  syncOutreachAccountsForCoach,
} from "@/lib/unipile/outreachAccounts";
import { isUnipileConfigured } from "@/lib/unipile/client";
import {
  isConnectableProvider,
  normalizeUnipileProvider,
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
  const auth = await requireOutreachCoach(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    account_id?: string;
    provider?: string;
    returnTo?: string;
  };
  try {
    if (body.action === "sync") {
      const accounts = await syncOutreachAccountsForCoach(auth.coachId);
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
      const accounts = await removeOutreachAccount(auth.coachId, accountId);
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
    const accounts = await listOutreachAccounts(auth.coachId);
    const existing = accounts.find((row) => {
      if (normalizeUnipileProvider(row.provider) !== providerRaw) return false;
      if (!row.unipile_account_id?.trim()) return false;
      const status = (row.status || "").toUpperCase();
      return status !== "OK" && status !== "CONNECTING";
    });
    const { url } = await createProviderConnectLink(
      auth.coachId,
      request,
      providerRaw as UnipileConnectProvider,
      {
        returnTo: parseUnipileConnectReturnTo(body.returnTo),
        reconnectAccountId: existing?.unipile_account_id,
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
