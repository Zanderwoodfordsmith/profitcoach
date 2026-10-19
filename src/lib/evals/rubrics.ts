import * as fs from "node:fs";
import * as path from "node:path";

import { peekAgentOverride } from "@/lib/agent/agentOverrides";
import { parseFrontmatter } from "@/lib/agent/context";

import { RUBRIC_FILES, type ArtifactKind, type Criterion, type Rubric } from "./types";

const RUBRIC_DIR = path.join(process.cwd(), "content", "agent", "evals", "rubrics");

/** Admin edits (agent_context_files) win over the repo file, like every other Ava file. */
export function rubricFileId(kind: Exclude<ArtifactKind, "linkedin.basics">): string {
  return `agent/evals/rubrics/${RUBRIC_FILES[kind]}`;
}

function readRubricSource(kind: Exclude<ArtifactKind, "linkedin.basics">): string {
  const override = peekAgentOverride(rubricFileId(kind));
  if (override) return override;
  return fs.readFileSync(path.join(RUBRIC_DIR, RUBRIC_FILES[kind]), "utf8");
}

/** "### hook | weight 3 | Desire hook as a question" followed by anchor lines. */
export function parseCriteria(body: string): Criterion[] {
  const section = body.split(/^## /m).find((part) => part.startsWith("Criteria"));
  if (!section) return [];
  const out: Criterion[] = [];
  for (const chunk of section.split(/^### /m).slice(1)) {
    const [head, ...rest] = chunk.split("\n");
    const parts = (head ?? "").split("|").map((p) => p.trim());
    const id = parts[0] ?? "";
    const weight = Number((parts[1] ?? "").replace(/[^0-9.]/g, ""));
    if (!/^[a-z_]+$/.test(id) || !Number.isFinite(weight) || weight <= 0) continue;
    out.push({ id, weight, label: parts.slice(2).join(" | ") || id, anchors: rest.join("\n").trim() });
  }
  return out;
}

function exampleUnder(body: string, name: "Strong" | "Weak"): string | null {
  const examples = body.split(/^## /m).find((part) => part.startsWith("Examples"));
  if (!examples) return null;
  const chunk = examples.split(/^### /m).find((part) => part.startsWith(name));
  if (!chunk) return null;
  const text = chunk.slice(name.length).trim();
  return text || null;
}

export function parseRubric(kind: ArtifactKind, raw: string): Rubric {
  const { meta, body } = parseFrontmatter(raw);
  const pass = Number(meta.pass);
  return {
    id: kind,
    title: typeof meta.title === "string" && meta.title ? meta.title : kind,
    pass: Number.isFinite(pass) && pass > 0 ? pass : 70,
    text: body,
    criteria: parseCriteria(body),
    examples: { strong: exampleUnder(body, "Strong"), weak: exampleUnder(body, "Weak") },
  };
}

export function loadRubric(kind: Exclude<ArtifactKind, "linkedin.basics">): Rubric {
  const rubric = parseRubric(kind, readRubricSource(kind));
  if (!rubric.criteria.length) throw new Error(`Rubric ${kind} has no criteria the code can read.`);
  return rubric;
}
