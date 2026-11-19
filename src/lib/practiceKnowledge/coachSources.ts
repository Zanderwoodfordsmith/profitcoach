import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Server-only: Admin → Coaches → Sources (19 Nov). Everything Ava and the
 * Blueprint writers read for one coach, plus what BCA adds by hand: pasted
 * notes, or a voice note or video the coach sent, transcribed here.
 */

export const SOURCES_BUCKET = "coach-sources";

export const SOURCE_LABELS: Record<string, string> = {
  blueprint_call_notes: "Pam's notes",
  blueprint_call: "Blueprint call",
  bca_sales_call: "Sales call",
  bca_added: "Added by BCA",
};

export type CoachSource = {
  id: string;
  source: string;
  label: string;
  title: string;
  called_at: string | null;
  ingested_at: string;
  body: string;
  file_url: string | null;
  added_by_name: string | null;
};

export async function listCoachSources(coachId: string): Promise<CoachSource[]> {
  const { data, error } = await supabaseAdmin
    .from("practice_source_transcripts")
    .select("id, source, title, called_at, ingested_at, body, file_path, added_by")
    .eq("coach_id", coachId)
    .order("called_at", { ascending: false, nullsFirst: false });
  if (error) throw new Error(error.message);
  const rows = data ?? [];

  const adderIds = [...new Set(rows.map((row) => row.added_by).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  if (adderIds.length) {
    const { data: people } = await supabaseAdmin.from("profiles").select("id, full_name").in("id", adderIds);
    for (const person of people ?? []) names.set(person.id, (person.full_name ?? "").trim());
  }

  return Promise.all(
    rows.map(async (row) => {
      let fileUrl: string | null = null;
      if (row.file_path) {
        const { data: signed } = await supabaseAdmin.storage.from(SOURCES_BUCKET).createSignedUrl(row.file_path, 60 * 60);
        fileUrl = signed?.signedUrl ?? null;
      }
      return {
        id: row.id,
        source: row.source,
        label: SOURCE_LABELS[row.source] ?? row.source,
        title: row.title,
        called_at: row.called_at,
        ingested_at: row.ingested_at,
        body: row.body,
        file_url: fileUrl,
        added_by_name: row.added_by ? names.get(row.added_by) || null : null,
      };
    })
  );
}

/** Where an upload goes: one folder per coach, a safe file name. */
export function uploadPath(coachId: string, fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  const ext = dot > 0 ? fileName.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) : "";
  const stem = (dot > 0 ? fileName.slice(0, dot) : fileName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${coachId}/${Date.now()}-${stem || "file"}${ext ? `.${ext}` : ""}`;
}

type ScribeWord = { text: string; type?: string; speaker_id?: string };

/** One speaker: plain text. Several: "Speaker 1: ..." paragraphs. */
function scribeText(result: { text?: string; words?: ScribeWord[] }): string {
  const words = result.words ?? [];
  const speakers = new Set(words.filter((w) => w.type === "word" && w.speaker_id).map((w) => w.speaker_id));
  if (speakers.size < 2) return (result.text ?? "").trim();

  const order = [...speakers];
  const lines: string[] = [];
  let current: string | undefined;
  let line = "";
  for (const word of words) {
    if (word.type === "word" && word.speaker_id !== current) {
      if (line.trim()) lines.push(`Speaker ${order.indexOf(current) + 1}: ${line.trim()}`);
      current = word.speaker_id;
      line = "";
    }
    line += word.type === "spacing" ? " " : word.text;
  }
  if (line.trim()) lines.push(`Speaker ${order.indexOf(current) + 1}: ${line.trim()}`);
  return lines.join("\n\n");
}

/** Transcribe an uploaded file with ElevenLabs Scribe, reading it straight from storage. */
export async function transcribeStoredFile(path: string): Promise<string> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ElevenLabs isn't set up (ELEVENLABS_API_KEY).");
  const { data: signed, error } = await supabaseAdmin.storage.from(SOURCES_BUCKET).createSignedUrl(path, 60 * 60);
  if (error || !signed?.signedUrl) throw new Error("Couldn't read the uploaded file.");

  const form = new FormData();
  form.set("model_id", "scribe_v1");
  form.set("cloud_storage_url", signed.signedUrl);
  form.set("diarize", "true");
  form.set("tag_audio_events", "false");
  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": key },
    body: form,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Transcription failed (${res.status}). ${detail.slice(0, 200)}`.trim());
  }
  const text = scribeText(await res.json());
  if (!text) throw new Error("No speech found in that file.");
  return text;
}

export async function addCoachSource(input: {
  coachId: string;
  addedBy: string;
  title: string;
  calledAt: string | null;
  body: string;
  filePath: string | null;
}): Promise<void> {
  const { error } = await supabaseAdmin.from("practice_source_transcripts").insert({
    coach_id: input.coachId,
    source: "bca_added",
    external_id: crypto.randomUUID(),
    title: input.title.slice(0, 200),
    called_at: input.calledAt,
    body: input.body.trim().slice(0, 80_000),
    file_path: input.filePath,
    added_by: input.addedBy,
  });
  if (error) throw new Error(error.message);
}

export async function removeCoachSource(coachId: string, id: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("practice_source_transcripts")
    .delete()
    .eq("coach_id", coachId)
    .eq("id", id)
    .select("file_path")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data?.file_path) await supabaseAdmin.storage.from(SOURCES_BUCKET).remove([data.file_path]);
}
