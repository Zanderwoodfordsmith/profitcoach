import * as fs from "node:fs";
import * as path from "node:path";

import { readBrandKnowledgeRepoFile } from "@/lib/profitCoachAi/brandKnowledge";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Save history for the files Ava and the Create hub read (table
 * ava_file_versions). Before a save or a reset replaces a file, the content
 * that was live is kept, with who saved it and when. Restore is a save of an
 * old version, so it goes into the history too.
 *
 * store "agent": agent_context_files, file = path under content/ (agent/…, practice-skills/…).
 * store "brand": brand_knowledge_files, file = brand file name (icp.md, reply-copilot/ROUTER.md).
 */

export type FileStore = "agent" | "brand";

export type FileVersion = {
  id: number;
  content: string;
  saved_at: string;
  saved_by: string | null;
  /** Null when saved_by is empty: the repo file as it was before the first edit. */
  saved_by_name: string | null;
};

const CONTENT_ROOT = path.join(process.cwd(), "content");

function tableFor(store: FileStore): "agent_context_files" | "brand_knowledge_files" {
  return store === "brand" ? "brand_knowledge_files" : "agent_context_files";
}

function repoContent(store: FileStore, file: string): string | null {
  if (store === "brand") return readBrandKnowledgeRepoFile(file);
  const full = path.resolve(CONTENT_ROOT, file);
  if (!full.startsWith(CONTENT_ROOT + path.sep) || !fs.existsSync(full)) return null;
  return fs.readFileSync(full, "utf8");
}

/**
 * Keep what is live now before it is replaced. Never blocks the save: a
 * failure is logged and the save goes ahead.
 */
export async function keepPreviousVersion(
  store: FileStore,
  file: string,
  next: string | null
): Promise<void> {
  const { data: row, error } = await supabaseAdmin
    .from(tableFor(store))
    .select("content, updated_at, updated_by")
    .eq("file", file)
    .maybeSingle();
  if (error) {
    console.error("keepPreviousVersion read:", error.message);
    return;
  }
  const previous =
    typeof row?.content === "string"
      ? { content: row.content, saved_at: row.updated_at as string, saved_by: (row.updated_by as string | null) ?? null }
      : (() => {
          const repo = repoContent(store, file);
          return repo === null ? null : { content: repo, saved_at: new Date().toISOString(), saved_by: null };
        })();
  if (!previous || !previous.content.trim() || previous.content === next) return;
  const { error: insertError } = await supabaseAdmin
    .from("ava_file_versions")
    .insert({ store, file, ...previous });
  if (insertError) console.error("keepPreviousVersion insert:", insertError.message);
}

/** Save a file over its repo default, keeping the previous version first. */
export async function saveFileWithHistory(opts: {
  store: FileStore;
  file: string;
  content: string;
  userId: string;
}): Promise<{ error: string | null }> {
  await keepPreviousVersion(opts.store, opts.file, opts.content);
  const { error } = await supabaseAdmin.from(tableFor(opts.store)).upsert({
    file: opts.file,
    content: opts.content,
    updated_at: new Date().toISOString(),
    updated_by: opts.userId,
  });
  return { error: error?.message ?? null };
}

/** Remove the edit so the repo file is live again, keeping the edit first. */
export async function resetFileWithHistory(store: FileStore, file: string): Promise<{ error: string | null }> {
  await keepPreviousVersion(store, file, repoContent(store, file));
  const { error } = await supabaseAdmin.from(tableFor(store)).delete().eq("file", file);
  return { error: error?.message ?? null };
}

/** The newest saves first. */
export async function listFileVersions(store: FileStore, file: string, limit = 12): Promise<FileVersion[]> {
  const { data, error } = await supabaseAdmin
    .from("ava_file_versions")
    .select("id, content, saved_at, saved_by")
    .eq("store", store)
    .eq("file", file)
    .order("id", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("listFileVersions:", error.message);
    return [];
  }
  const rows = (data ?? []) as Array<{ id: number; content: string; saved_at: string; saved_by: string | null }>;
  const names = await profileNames(rows.map((r) => r.saved_by));
  return rows.map((r) => ({ ...r, saved_by_name: r.saved_by ? (names.get(r.saved_by) ?? "Someone") : null }));
}

export async function getFileVersion(store: FileStore, file: string, id: number): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("ava_file_versions")
    .select("content")
    .eq("store", store)
    .eq("file", file)
    .eq("id", id)
    .maybeSingle();
  return typeof data?.content === "string" ? data.content : null;
}

/** Who saved what is live now, and when. Null when the repo file is live. */
export async function liveFileSave(
  store: FileStore,
  file: string
): Promise<{ saved_at: string; saved_by_name: string } | null> {
  const { data } = await supabaseAdmin
    .from(tableFor(store))
    .select("updated_at, updated_by")
    .eq("file", file)
    .maybeSingle();
  if (!data) return null;
  const by = (data.updated_by as string | null) ?? null;
  const names = await profileNames([by]);
  return { saved_at: data.updated_at as string, saved_by_name: by ? (names.get(by) ?? "Someone") : "Someone" };
}

async function profileNames(ids: Array<string | null>): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (!unique.length) return new Map();
  const { data } = await supabaseAdmin.from("profiles").select("id, full_name").in("id", unique);
  return new Map(
    (data ?? []).map((p) => [p.id as string, (typeof p.full_name === "string" && p.full_name.trim()) || "Someone"])
  );
}
