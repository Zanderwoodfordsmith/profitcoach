import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize, relative } from "node:path";
import { describe, it } from "node:test";

/**
 * Browser code must not import server-only modules. Importing the service-role
 * Supabase client or Node's crypto from anything a "use client" file reaches
 * ships them to every visitor (crypto alone is a ~120KB polyfill), and one
 * stray import used to put both on every page. Split the pure helpers into a
 * client-safe module instead (see primaryCoachConstants.ts for the pattern).
 */

const ROOT = join(__dirname, "..", "..");
const SRC = join(ROOT, "src");
const FORBIDDEN_FILES = [join(SRC, "lib", "supabaseAdmin.ts")];
const FORBIDDEN_PACKAGES = new Set(["crypto", "node:crypto"]);
const IMPORT_RE =
  /(?:import|export)\s+(type\s+)?(?:[^'"]*?from\s+)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;

function listSourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) listSourceFiles(path, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

function resolveImport(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = normalize(join(dirname(from), spec));
  else return null;
  for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const path = base + ext;
    if (existsSync(path) && statSync(path).isFile()) return path;
  }
  return null;
}

/** Shortest import chain from `entry` to something forbidden, or null. */
function forbiddenChain(entry: string): string[] | null {
  const prev = new Map<string, string | null>([[entry, null]]);
  const queue = [entry];
  while (queue.length) {
    const file = queue.shift()!;
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(IMPORT_RE)) {
      if (m[1]) continue; // type-only
      const spec = m[2] ?? m[3];
      if (!spec) continue;
      const chainTo = (end: string) => {
        const chain = [end];
        for (let at: string | null = file; at; at = prev.get(at) ?? null) chain.push(relative(ROOT, at));
        return chain;
      };
      if (FORBIDDEN_PACKAGES.has(spec)) return chainTo(spec);
      const target = resolveImport(file, spec);
      if (!target || prev.has(target)) continue;
      prev.set(target, file);
      if (FORBIDDEN_FILES.includes(target)) return chainTo(relative(ROOT, target));
      queue.push(target);
    }
  }
  return null;
}

describe("client bundles", () => {
  it("never reach the service-role Supabase client or Node crypto", () => {
    const clientFiles = listSourceFiles(SRC).filter((file) =>
      /^\s*["']use client["']/.test(readFileSync(file, "utf8"))
    );
    assert.ok(clientFiles.length > 50, "expected to find client components");
    const problems: string[] = [];
    for (const file of clientFiles) {
      const chain = forbiddenChain(file);
      if (chain) problems.push(chain.join(" <- "));
    }
    assert.deepEqual(problems, []);
  });
});
