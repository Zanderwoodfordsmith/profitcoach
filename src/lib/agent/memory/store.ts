import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Ava's memory rows (table ava_memory). Every item from a source becomes:
 * - short (up to RAW_CHUNK characters): one "item" row holding all of it;
 * - long: an "item" header (title and opening), the raw text in "raw" chunks,
 *   and, when Haiku notes were made, "segment" and "atom" rows.
 * Notes are pointers for keyword search; the raw text is what was said.
 * Writing an item replaces its old rows, so a connector can run twice safely.
 */

export const RAW_CHUNK = 4_000;

export type MemoryAudience = "coach" | "admin";

export type MemorySource = "ava_chat" | "sales_call" | "zoom_call" | "linkedin_post" | "newsletter";

export type MemoryNotes = {
  segments: Array<{ title: string; question: string; summary: string }>;
  atoms: Array<{ type: string; text: string }>;
};

export type MemoryItem = {
  coachId: string;
  audience: MemoryAudience;
  source: MemorySource;
  sourceId: string;
  ts: string;
  title: string;
  text: string;
  url?: string | null;
  notes?: MemoryNotes | null;
  metadata?: Record<string, unknown>;
};

type Row = {
  coach_id: string;
  audience: MemoryAudience;
  source: MemorySource;
  source_id: string;
  kind: "item" | "segment" | "atom" | "raw";
  ts: string;
  title: string;
  content: string;
  url: string | null;
  metadata: Record<string, unknown>;
};

/** API keys, tokens and passwords never go into memory. */
export function maskSecrets(text: string): string {
  return text
    .replace(/\b(sk|pk|rk)[-_](live|test|ant|proj)?[-_]?[A-Za-z0-9_-]{16,}\b/g, "[hidden key]")
    .replace(/\b(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})\b/g, "[hidden token]")
    .replace(/\b[a-f0-9]{40,}\b/gi, "[hidden token]")
    .replace(/\b(password|passcode|pwd|api[_ ]?key|secret)\b(\s*[:=]\s*|\s+is\s+)\S+/gi, "$1$2[hidden]");
}

/** Cut at whitespace near the limit so a word is never split. */
export function chunkText(text: string, size = RAW_CHUNK): string[] {
  const chunks: string[] = [];
  let rest = text.trim();
  while (rest.length > size) {
    let cut = rest.lastIndexOf("\n", size);
    if (cut < size * 0.6) cut = rest.lastIndexOf(" ", size);
    if (cut < size * 0.6) cut = size;
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

function rowsFor(item: MemoryItem): Row[] {
  const text = maskSecrets(item.text.trim());
  const base = {
    coach_id: item.coachId,
    audience: item.audience,
    source: item.source,
    source_id: item.sourceId,
    ts: item.ts,
    url: item.url ?? null,
  };
  const meta = item.metadata ?? {};
  if (text.length <= RAW_CHUNK) {
    return [{ ...base, kind: "item", title: item.title, content: text, metadata: meta }];
  }
  const rows: Row[] = [
    { ...base, kind: "item", title: item.title, content: text.slice(0, 600), metadata: { ...meta, chars: text.length } },
  ];
  for (const seg of item.notes?.segments ?? []) {
    rows.push({ ...base, kind: "segment", title: seg.title, content: `${seg.question}\n${seg.summary}`, metadata: meta });
  }
  for (const atom of item.notes?.atoms ?? []) {
    rows.push({ ...base, kind: "atom", title: `${item.title} · ${atom.type}`, content: atom.text, metadata: meta });
  }
  chunkText(text).forEach((chunk, i) => {
    rows.push({ ...base, kind: "raw", title: item.title, content: chunk, metadata: { ...meta, chunk: i } });
  });
  return rows;
}

/** Replace these items' rows (all from one source). */
export async function replaceItems(source: MemorySource, items: MemoryItem[]): Promise<void> {
  if (!items.length) return;
  for (let i = 0; i < items.length; i += 200) {
    const ids = items.slice(i, i + 200).map((item) => item.sourceId);
    const { error } = await supabaseAdmin.from("ava_memory").delete().eq("source", source).in("source_id", ids);
    if (error) throw new Error(`ava_memory delete: ${error.message}`);
  }
  const rows = items.flatMap(rowsFor);
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabaseAdmin.from("ava_memory").insert(rows.slice(i, i + 500));
    if (error) throw new Error(`ava_memory insert: ${error.message}`);
  }
}

/** Remove items that no longer have anything worth keeping (e.g. a chat emptied). */
export async function removeItems(source: MemorySource, sourceIds: string[]): Promise<void> {
  if (!sourceIds.length) return;
  const { error } = await supabaseAdmin.from("ava_memory").delete().eq("source", source).in("source_id", sourceIds);
  if (error) throw new Error(`ava_memory delete: ${error.message}`);
}

export async function getWatermark(source: MemorySource): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("ava_memory_state")
    .select("watermark")
    .eq("source", source)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.watermark as string | null) ?? null;
}

export async function saveState(
  source: MemorySource,
  patch: { watermark?: string | null; lastError?: string | null }
): Promise<void> {
  const now = new Date().toISOString();
  const row: Record<string, unknown> = { source, last_run_at: now, updated_at: now, last_error: patch.lastError ?? null };
  if (patch.watermark !== undefined) row.watermark = patch.watermark;
  const { error } = await supabaseAdmin.from("ava_memory_state").upsert(row, { onConflict: "source" });
  if (error) throw new Error(error.message);
}
