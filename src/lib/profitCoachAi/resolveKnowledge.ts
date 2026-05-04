import * as fs from "node:fs";
import * as path from "node:path";

import type { KnowledgeRef } from "./types";

const ROOT = process.cwd();
const PLAYBOOKS_ROOT = path.join(ROOT, "content", "playbooks", "Source");
const AI_KNOWLEDGE_DIR = path.join(ROOT, "content", "ai-knowledge");
const LEGACY_KNOWLEDGE_DIR = path.join(ROOT, "src", "knowledge");

const DEFAULT_MAX_CHARS = 90_000;
const MAX_CSV_CHARS = 120_000;

function assertUnderRoot(resolved: string, allowedRoot: string): boolean {
  const normRoot = path.resolve(allowedRoot) + path.sep;
  const normFile = path.resolve(resolved);
  return normFile === path.resolve(allowedRoot) || normFile.startsWith(normRoot);
}

function listMdFilesInDir(dir: string, maxFiles: number): string[] {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return [];
  const names = fs.readdirSync(dir);
  const md = names
    .filter((n) => n.endsWith(".md"))
    .sort()
    .slice(0, maxFiles)
    .map((n) => path.join(dir, n));
  return md;
}

function expandRefToFiles(ref: KnowledgeRef): string[] {
  if (ref.type === "ai-knowledge") {
    const full = path.join(AI_KNOWLEDGE_DIR, ref.file);
    if (!assertUnderRoot(full, AI_KNOWLEDGE_DIR)) return [];
    return fs.existsSync(full) ? [full] : [];
  }
  if (ref.type === "legacy-knowledge") {
    const full = path.join(LEGACY_KNOWLEDGE_DIR, ref.file);
    if (!assertUnderRoot(full, LEGACY_KNOWLEDGE_DIR)) return [];
    if (!fs.existsSync(full)) return [];
    return [full];
  }
  // playbook
  const full = path.join(PLAYBOOKS_ROOT, ref.path);
  if (!assertUnderRoot(full, PLAYBOOKS_ROOT)) return [];
  if (!fs.existsSync(full)) return [];
  const st = fs.statSync(full);
  if (st.isFile()) return [full];
  if (st.isDirectory()) return listMdFilesInDir(full, 12);
  return [];
}

/**
 * Load markdown/CSV text for knowledge refs; caps total characters.
 */
export function resolveKnowledgeRefs(
  refs: KnowledgeRef[],
  maxChars: number = DEFAULT_MAX_CHARS
): string {
  const seen = new Set<string>();
  const parts: string[] = [];
  let used = 0;

  for (const ref of refs) {
    const files = expandRefToFiles(ref);
    for (const file of files) {
      if (seen.has(file)) continue;
      seen.add(file);
      let body = fs.readFileSync(file, "utf8");
      const rel = path.relative(ROOT, file);
      if (file.endsWith(".csv")) {
        if (body.length > MAX_CSV_CHARS) {
          body =
            body.slice(0, MAX_CSV_CHARS) + "\n\n[Truncated for length.]";
        }
        const chunk = `\n\n## File: ${rel}\n\n\`\`\`csv\n${body}\n\`\`\`\n`;
        if (used + chunk.length > maxChars) break;
        parts.push(chunk);
        used += chunk.length;
      } else {
        const chunk = `\n\n## File: ${rel}\n\n${body}\n`;
        if (used + chunk.length > maxChars) {
          const room = maxChars - used;
          if (room > 500) {
            parts.push(chunk.slice(0, room) + "\n\n[Truncated for length.]\n");
            used = maxChars;
          }
          break;
        }
        parts.push(chunk);
        used += chunk.length;
      }
      if (used >= maxChars) break;
    }
    if (used >= maxChars) break;
  }

  return parts.join("").trim();
}
