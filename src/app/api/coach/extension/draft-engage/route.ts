import { NextResponse } from "next/server";
import { requireExtensionLinkedInAccess } from "@/lib/extensionLinkedIn/access";
import {
  draftLinkedInEngage,
  type EngageKind,
} from "@/lib/extensionLinkedIn/draftEngage";
import { extensionAuthErrorPayload } from "@/lib/extensionLinkedIn/httpErrors";

type Body = {
  kind?: EngageKind;
  text?: string;
  authorName?: string | null;
  authorHeadline?: string | null;
  thread?: string | null;
};

export async function POST(request: Request) {
  const auth = await requireExtensionLinkedInAccess(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json(extensionAuthErrorPayload(auth), {
      status: auth.status ?? 403,
    });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const kind =
    body.kind === "comment" || body.kind === "reply" ? body.kind : null;
  if (!kind) {
    return NextResponse.json(
      { error: 'kind must be "comment" or "reply".' },
      { status: 400 }
    );
  }

  try {
    const { variants } = await draftLinkedInEngage({
      coachId: auth.userId,
      kind,
      context: {
        text: body.text ?? "",
        authorName: body.authorName,
        authorHeadline: body.authorHeadline,
        thread: body.thread,
      },
    });
    return NextResponse.json({ ok: true, kind, variants });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unable to draft engagement.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
