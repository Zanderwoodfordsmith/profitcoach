import { NextResponse } from "next/server";
import { requireOutreachCoach } from "@/lib/unipile/requireOutreachCoach";
import {
  createProviderConnectLink,
  parseUnipileConnectReturnTo,
} from "@/lib/unipile/hostedAuth";

/**
 * Connect Google for booking via Unipile (mail + calendar).
 * Kept at this path so older settings buttons still work.
 */
export async function GET(request: Request) {
  const auth = await requireOutreachCoach(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const url = new URL(request.url);
  const returnToRaw = url.searchParams.get("returnTo")?.trim() || "";
  const returnTo =
    returnToRaw.includes("/support")
      ? "support"
      : returnToRaw.includes("/calls")
        ? "calls"
        : parseUnipileConnectReturnTo(returnToRaw);

  try {
    const { url: connectUrl } = await createProviderConnectLink(
      auth.coachId,
      request,
      "GOOGLE",
      { returnTo }
    );
    return NextResponse.json({ url: connectUrl });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not start Google connect.",
      },
      { status: 500 }
    );
  }
}
