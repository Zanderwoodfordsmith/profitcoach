import { NextResponse } from "next/server";
import { requireOutreachCoach } from "@/lib/unipile/requireOutreachCoach";
import {
  createLinkedInConnectLink,
  createProviderConnectLink,
  listOutreachAccounts,
  removeOutreachAccount,
  syncOutreachAccountsForCoach,
} from "@/lib/unipile/accounts";
import { isUnipileConfigured } from "@/lib/unipile/client";
import {
  isConnectableProvider,
  type UnipileConnectProvider,
} from "@/lib/unipile/providers";

export async function GET(request: Request) {
  const auth = await requireOutreachCoach(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  try {
    const accounts = await listOutreachAccounts(auth.coachId);
    return NextResponse.json({
      configured: isUnipileConfigured(),
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
    return_to?: "settings" | "campaigns" | "lead-finder";
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

    const providerRaw = (body.provider || "LINKEDIN").toUpperCase();
    if (!isConnectableProvider(providerRaw)) {
      return NextResponse.json(
        { error: `Unsupported provider: ${providerRaw}` },
        { status: 400 }
      );
    }
    const provider = providerRaw as UnipileConnectProvider;
    const returnTo =
      body.return_to === "campaigns"
        ? "campaigns"
        : body.return_to === "lead-finder"
          ? "lead-finder"
          : "settings";

    const { url } =
      provider === "LINKEDIN" && returnTo === "campaigns"
        ? await createLinkedInConnectLink(auth.coachId, request)
        : await createProviderConnectLink(auth.coachId, request, provider, {
            returnTo,
          });
    return NextResponse.json({ url, provider });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Connect failed." },
      { status: 500 }
    );
  }
}
