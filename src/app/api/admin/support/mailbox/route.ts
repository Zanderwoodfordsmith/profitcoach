import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import {
  claimSupportMailboxFromUnipile,
  createSupportMailboxConnectLink,
  disconnectSupportMailbox,
  getSupportMailboxAccount,
  syncSupportMailboxInbound,
} from "@/lib/support/mailbox";
import { isUnipileConfigured } from "@/lib/unipile/client";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    let account = await getSupportMailboxAccount();
    // Localhost notify_url can't be reached by Unipile — claim on load if
    // support@ is already connected in Unipile but not saved yet.
    if (!account && isUnipileConfigured()) {
      account = await claimSupportMailboxFromUnipile(auth.userId);
    }
    // Same localhost webhook gap: poll recent mail into tickets on admin load.
    let sync: Awaited<ReturnType<typeof syncSupportMailboxInbound>> | null =
      null;
    if (account && isUnipileConfigured()) {
      sync = await syncSupportMailboxInbound(15).catch((err) => {
        console.warn("support mailbox sync on GET:", err);
        return null;
      });
    }
    return NextResponse.json({
      configured: isUnipileConfigured(),
      account: account
        ? {
            id: account.id,
            provider: account.provider,
            status: account.status,
            display_name: account.display_name,
            unipile_account_id: account.unipile_account_id,
            last_synced_at: account.last_synced_at,
          }
        : null,
      sync,
    });
  } catch (e) {
    console.error("support mailbox GET:", e);
    return NextResponse.json(
      { error: "Could not load support mailbox." },
      { status: 500 }
    );
  }
}

type Body = {
  action?:
    | "connect"
    | "disconnect"
    | "tidy_ticket"
    | "trash_ticket"
    | "claim"
    | "reconnect";
  provider?: "GOOGLE" | "OUTLOOK";
  ticketId?: string;
};

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const action = body.action;
  if (
    action !== "connect" &&
    action !== "disconnect" &&
    action !== "tidy_ticket" &&
    action !== "trash_ticket" &&
    action !== "claim" &&
    action !== "reconnect"
  ) {
    return NextResponse.json(
      {
        error:
          "action must be connect, reconnect, disconnect, claim, tidy_ticket, or trash_ticket.",
      },
      { status: 400 }
    );
  }

  try {
    if (action === "disconnect") {
      await disconnectSupportMailbox();
      return NextResponse.json({ ok: true });
    }

    if (action === "claim") {
      const account = await claimSupportMailboxFromUnipile(auth.userId);
      if (!account) {
        return NextResponse.json(
          {
            error:
              "No support@ Gmail found in Unipile yet. Connect it, then try again.",
          },
          { status: 404 }
        );
      }
      return NextResponse.json({
        ok: true,
        account: {
          id: account.id,
          provider: account.provider,
          status: account.status,
          display_name: account.display_name,
          unipile_account_id: account.unipile_account_id,
          last_synced_at: account.last_synced_at,
        },
      });
    }

    if (action === "tidy_ticket" || action === "trash_ticket") {
      const ticketId = body.ticketId?.trim();
      if (!ticketId) {
        return NextResponse.json(
          { error: "ticketId is required." },
          { status: 400 }
        );
      }
      const { tidySupportEmailForTicket, trashSupportEmailForTicket } =
        await import("@/lib/support/mailbox");
      if (action === "trash_ticket") {
        await trashSupportEmailForTicket(ticketId);
      } else {
        await tidySupportEmailForTicket(ticketId);
      }
      return NextResponse.json({ ok: true });
    }

    const provider = body.provider === "OUTLOOK" ? "OUTLOOK" : "GOOGLE";
    const existing =
      action === "reconnect" ? await getSupportMailboxAccount() : null;
    const { url } = await createSupportMailboxConnectLink(
      auth.userId,
      request,
      provider,
      existing?.unipile_account_id
    );
    return NextResponse.json({ url });
  } catch (e) {
    console.error("support mailbox POST:", e);
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Could not update mailbox.",
      },
      { status: 400 }
    );
  }
}
