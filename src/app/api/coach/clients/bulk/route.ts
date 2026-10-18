import { NextResponse } from "next/server";
import { parseClientRosterCreate } from "@/lib/clientRoster/fields";
import { ClientSaveError, saveRosterClient } from "@/lib/clientRoster/save";
import { requireCoachRequest } from "@/lib/requireCoachRequest";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_ROWS = 300;

/**
 * Add many clients at once (pasted from a spreadsheet). Body: { rows: [...] }
 * using the same fields as the single form. Each row succeeds or fails on its
 * own; the reply says which rows need fixing and why.
 */
export async function POST(request: Request) {
  const auth = await requireCoachRequest(request);
  if (auth.error || !auth.userId) return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { rows?: unknown } | null;
  const rows = Array.isArray(body?.rows) ? body!.rows : null;
  if (!rows || !rows.length) return NextResponse.json({ error: "No rows to add." }, { status: 400 });
  if (rows.length > MAX_ROWS) return NextResponse.json({ error: `Add up to ${MAX_ROWS} clients at a time.` }, { status: 400 });

  const results: { row: number; ok: boolean; created?: boolean; error?: string }[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    try {
      const fields = parseClientRosterCreate(rows[i]);
      const saved = await saveRosterClient(auth.userId, fields);
      results.push({ row: i + 1, ok: true, created: saved.created });
    } catch (err) {
      const message =
        err instanceof ClientSaveError || err instanceof Error ? err.message : "Unable to save client.";
      results.push({ row: i + 1, ok: false, error: message.startsWith("Unable") || message.length < 200 ? message : "Unable to save client." });
    }
  }
  return NextResponse.json({
    added: results.filter((r) => r.ok && r.created).length,
    updated: results.filter((r) => r.ok && !r.created).length,
    failed: results.filter((r) => !r.ok),
  });
}
