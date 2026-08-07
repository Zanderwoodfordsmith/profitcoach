import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import JSZip from "jszip";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  matchConnectionTitles,
  parseConnectionsCsv,
} from "@/lib/firstCampaign/parseConnectionsCsv";

export const maxDuration = 60;

const INSERT_CHUNK_SIZE = 500;
const MAX_CONNECTIONS = 20_000;

async function extractConnectionsCsvText(file: File): Promise<string> {
  const nameLower = file.name.toLowerCase();

  if (nameLower.endsWith(".zip")) {
    const buf = Buffer.from(await file.arrayBuffer());
    const zip = await JSZip.loadAsync(buf);
    const entries = Object.keys(zip.files);
    const preferred =
      entries.find((n) => /(^|\/)Connections\.csv$/i.test(n)) ??
      entries.find((n) => /connections\.csv$/i.test(n));
    if (!preferred) {
      throw new Error("Zip uploaded, but no Connections.csv found inside.");
    }
    return zip.files[preferred].async("string");
  }

  return file.text();
}

export async function POST(request: Request) {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }
  const coachId = auth.userId;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  const extraKeywordsRaw = String(formData.get("extraKeywords") ?? "");
  const extraKeywords = extraKeywordsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  let text: string;
  try {
    text = await extractConnectionsCsvText(file);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not read upload." },
      { status: 400 }
    );
  }

  let parsed: ReturnType<typeof parseConnectionsCsv>;
  try {
    parsed = parseConnectionsCsv(text);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not parse Connections.csv.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (parsed.length === 0) {
    return NextResponse.json(
      { error: "No connections found in that file." },
      { status: 400 }
    );
  }

  const capped = parsed.slice(0, MAX_CONNECTIONS);
  const batchId = randomUUID();

  const rows = capped.map((c) => {
    const { matched, matchedTitles } = matchConnectionTitles(
      c.position,
      extraKeywords
    );
    return {
      coach_id: coachId,
      upload_batch_id: batchId,
      first_name: c.firstName || null,
      last_name: c.lastName || null,
      linkedin_url: c.linkedinUrl || null,
      email: c.email || null,
      company: c.company || null,
      position: c.position || null,
      connected_on: c.connectedOn || null,
      title_match: matched,
      matched_titles: matchedTitles,
      raw: c as unknown as Record<string, unknown>,
    };
  });

  for (let i = 0; i < rows.length; i += INSERT_CHUNK_SIZE) {
    const chunk = rows.slice(i, i + INSERT_CHUNK_SIZE);
    const { error } = await supabaseAdmin
      .from("coach_linkedin_connections")
      .insert(chunk);
    if (error) {
      return NextResponse.json(
        { error: `Failed to save connections: ${error.message}` },
        { status: 500 }
      );
    }
  }

  const titleMatchCount = rows.filter((r) => r.title_match).length;

  return NextResponse.json({
    batchId,
    total: rows.length,
    titleMatchCount,
    truncated: parsed.length > capped.length,
  });
}
