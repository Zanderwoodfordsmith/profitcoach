import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { cleanSpec } from "@/lib/newsletterCover/spec";
import { loadCutOut, renderCover } from "@/lib/newsletterCover/render";
import { COVER_BUCKET, cutOutUrl, ensureCoverBucket } from "@/lib/newsletterCover/storage";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Draws a newsletter cover from a template. Without `save` it returns the
 * picture for the preview; with `save` it stores it and returns its link, which
 * becomes the issue's cover. The header x-cover-photo says whether the coach's
 * cut-out photo was found.
 */
export async function POST(request: Request) {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error || !auth.userId) return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { spec?: unknown; save?: boolean } | null;
  const spec = cleanSpec(body?.spec);
  const cutOut = await loadCutOut(cutOutUrl(auth.userId));

  try {
    const image = await renderCover(spec, cutOut);
    const png = Buffer.from(await image.arrayBuffer());
    if (!body?.save) {
      return new Response(new Uint8Array(png), {
        headers: { "Content-Type": "image/png", "Cache-Control": "no-store", "x-cover-photo": cutOut ? "yes" : "no" },
      });
    }
    await ensureCoverBucket();
    const path = `${auth.userId}/cover-${randomUUID()}.png`;
    const { error } = await supabaseAdmin.storage.from(COVER_BUCKET).upload(path, png, { contentType: "image/png", upsert: false });
    if (error) throw new Error(error.message);
    return NextResponse.json({ url: supabaseAdmin.storage.from(COVER_BUCKET).getPublicUrl(path).data.publicUrl });
  } catch (err) {
    console.error("newsletter cover:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not make that cover. Try again." }, { status: 500 });
  }
}
