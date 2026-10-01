import * as fs from "node:fs";
import * as path from "node:path";

import { PROSPECT_SEARCH_PLAYBOOK } from "@/lib/salesNavigator/prospectSearch/playbook";
import type { AgentMode } from "./types";

/**
 * Loads the agent's context from content/agent, following the Interpretable
 * Context Methodology: AGENT.md (identity) and ROUTER.md (routing) are always
 * in the prompt; each capabilities/<id>/CONTEXT.md is loaded only when the
 * agent opens it, with the references its frontmatter lists.
 */

const CONTENT_ROOT = path.join(process.cwd(), "content");
const AGENT_ROOT = path.join(process.cwd(), "content", "agent");
const CAPABILITIES_ROOT = path.join(process.cwd(), "content", "agent", "capabilities");

const REFERENCE_MAX_CHARS = 14_000;

/** References that live in code rather than in a Markdown file. */
const CODE_REFERENCES: Record<string, { name: string; text: () => string }> = {
  "prospect-search-playbook": {
    name: "Sales Navigator prospect search playbook",
    text: () => PROSPECT_SEARCH_PLAYBOOK,
  },
};

export type Capability = {
  id: string;
  title: string;
  summary: string;
  tools: string[];
  references: string[];
  modes: AgentMode[];
  body: string;
};

type Frontmatter = Record<string, string | string[]>;

export function parseFrontmatter(raw: string): { meta: Frontmatter; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { meta: {}, body: raw };
  const meta: Frontmatter = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^([a-zA-Z_][\w-]*):\s*(.*)$/);
    if (!kv) continue;
    const value = kv[2].trim();
    const list = value.match(/^\[(.*)\]$/);
    meta[kv[1]] = list
      ? list[1]
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : value;
  }
  return { meta, body: raw.slice(match[0].length).trim() };
}

function asString(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

function asList(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function readText(file: string): string {
  return fs.readFileSync(file, "utf8").trim();
}

// Re-read in development so edits to the Markdown apply without a restart.
const shouldCache = process.env.NODE_ENV === "production";
let cachedCapabilities: Capability[] | null = null;

export function loadCapabilities(): Capability[] {
  if (shouldCache && cachedCapabilities) return cachedCapabilities;
  const ids = fs
    .readdirSync(CAPABILITIES_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const capabilities: Capability[] = [];
  for (const dir of ids) {
    const file = path.join(CAPABILITIES_ROOT, dir, "CONTEXT.md");
    if (!fs.existsSync(file)) continue;
    const { meta, body } = parseFrontmatter(readText(file));
    const modes = asList(meta.modes).filter(
      (mode): mode is AgentMode => mode === "admin" || mode === "coach"
    );
    capabilities.push({
      id: asString(meta.id) || dir,
      title: asString(meta.title) || dir,
      summary: asString(meta.summary),
      tools: asList(meta.tools),
      references: asList(meta.references),
      modes: modes.length ? modes : ["admin", "coach"],
      body,
    });
  }
  if (shouldCache) cachedCapabilities = capabilities;
  return capabilities;
}

export function getCapability(id: string, mode: AgentMode): Capability | null {
  const capability = loadCapabilities().find((cap) => cap.id === id) ?? null;
  if (!capability || !capability.modes.includes(mode)) return null;
  return capability;
}

export function capabilitiesForMode(mode: AgentMode): Capability[] {
  return loadCapabilities().filter((cap) => cap.modes.includes(mode));
}

export function loadIdentity(): string {
  return readText(path.join(AGENT_ROOT, "AGENT.md"));
}

export function loadRouter(): string {
  return readText(path.join(AGENT_ROOT, "ROUTER.md"));
}

/**
 * A reference is either `code:<id>` or a path under content/ such as
 * `agent/references/list-kpis.md` or `ai-knowledge/writing-rules.md`.
 */
export function resolveReference(ref: string): { name: string; text: string } | null {
  if (ref.startsWith("code:")) {
    const entry = CODE_REFERENCES[ref.slice("code:".length)];
    return entry ? { name: entry.name, text: entry.text() } : null;
  }
  const full = path.resolve(CONTENT_ROOT, ref);
  if (!full.startsWith(CONTENT_ROOT + path.sep) || !fs.existsSync(full)) return null;
  const text = readText(full);
  return {
    name: path.basename(ref),
    text:
      text.length > REFERENCE_MAX_CHARS
        ? `${text.slice(0, REFERENCE_MAX_CHARS)}\n\n[Truncated.]`
        : text,
  };
}

/** What open_capability returns: the contract (Layer 2) plus its references (Layer 3). */
export function capabilityContract(capability: Capability): string {
  const parts = [`# Capability: ${capability.title} (${capability.id})`, capability.body];
  for (const ref of capability.references) {
    const resolved = resolveReference(ref);
    if (!resolved) continue;
    parts.push(`## Reference: ${resolved.name}\n\n${resolved.text}`);
  }
  return parts.join("\n\n---\n\n");
}
