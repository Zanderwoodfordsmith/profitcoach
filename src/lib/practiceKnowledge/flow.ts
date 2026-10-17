import {
  ALWAYS_READS,
  BLUEPRINT_SECTIONS,
  answerReach,
  buildOrder,
  fieldFilled,
  sectionByKey,
  sectionReads,
  type FieldSpec,
  type SectionRef,
  type WriterSource,
} from "./blueprint";
import { handoffForSection } from "./campaignHandoff";
import { BLUEPRINT_OUTPUTS, type BlueprintOutput } from "./outputs";
import { SECTION_SKILLS, writerContract, writerUpstream } from "./skills";
import type { PracticeKnowledgeRow } from "./types";

/**
 * The Blueprint as a flow, for the admin flow map: the coach's answers, the
 * groundwork BCA writes from them, and what the coach gets. Drawn from the
 * contracts in blueprint.ts and outputs.ts, so it cannot drift from what the
 * writers are actually given. Server only (it reads the writer tasks).
 */

export type FlowKind = "coach" | "research" | "import" | "build" | "out";

export type FlowField = { path: string; label: string; required: boolean };

export type FlowWriter = {
  /** Answers it reads directly, as field paths. */
  reads: string[];
  /** Other material it reads, in words. */
  sources: string[];
  /** Node ids of the written sections it is built on. */
  builtOn: string[];
  /** Node ids of written sections it also reads when they exist. */
  alsoReads: string[];
  readsAll: boolean;
  method: string | null;
  task: string | null;
  signOff: string | null;
  goesTo: string | null;
  sendsToGetClients: boolean;
  /** What the full prompt preview shows. */
  preview: "section" | "linkedin" | "summary" | null;
};

export type FlowNode = {
  id: string;
  kind: FlowKind;
  label: string;
  /** Blueprint page slug and section key, to open it for a coach. */
  page: string | null;
  sectionKey: string | null;
  about: string | null;
  fields: FlowField[];
  /** Every writer is given this answer, whatever its contract says. */
  everyWriter: boolean;
  writer: FlowWriter | null;
  /** Outputs it reaches. */
  reach: number;
};

export type FlowGraph = {
  nodes: FlowNode[];
  edges: [string, string][];
  outputCount: number;
  /** Loaded for every Blueprint writer. */
  shared: string[];
};

/** Answers BCA could draft from research for the chosen market, for the coach to check. */
const RESEARCHABLE = new Set(["market:persona", "market:grid", "market:world", "market:triggers", "market:why"]);

const SOURCE_LABELS: Record<WriterSource, string> = {
  linkedin: "LinkedIn import",
  transcript: "Onboarding conversation",
  preread: "Decision Call pre-read",
  library: "Industry library",
};

const SHARED = [
  "content/practice-skills/_shared.md",
  "content/ai-knowledge/writing-rules.md",
  "The Decision Record",
  "Public or discreet, and location",
];

const OUTPUT_BY_SECTION = new Map(
  BLUEPRINT_OUTPUTS.filter((o) => o.section).map((o) => [o.section as string, o])
);

function nodeIdFor(sectionKey: string): string {
  return OUTPUT_BY_SECTION.get(sectionKey)?.id ?? sectionKey;
}

type WriterRef = { id: string; ref: SectionRef | null; output: BlueprintOutput | null };

function writers(): WriterRef[] {
  const foundations = buildOrder()
    .filter((key) => !OUTPUT_BY_SECTION.has(key))
    .map((key) => ({ id: key, ref: sectionByKey(key), output: null }));
  const outputs = BLUEPRINT_OUTPUTS.map((output) => ({
    id: output.id,
    ref: output.section ? sectionByKey(output.section) : null,
    output,
  }));
  return [...foundations, ...outputs];
}

function writerNeeds(w: WriterRef): string[] {
  return w.ref?.section.needs ?? w.output?.needs ?? [];
}

function writerFields(w: WriterRef): string[] {
  return (w.ref?.section.uses ?? w.output?.uses)?.fields ?? [];
}

function fieldIndex(): Map<string, { ref: SectionRef; field: FieldSpec }> {
  const out = new Map<string, { ref: SectionRef; field: FieldSpec }>();
  for (const ref of BLUEPRINT_SECTIONS) {
    if (ref.section.source === "we_build") continue;
    for (const field of ref.section.fields ?? []) out.set(field.path, { ref, field });
  }
  return out;
}

export function flowGraph(): FlowGraph {
  const fields = fieldIndex();
  const all = writers();
  const edges = new Map<string, [string, string]>();
  const addEdge = (a: string, b: string) => edges.set(`${a}>${b}`, [a, b]);

  const inputKeys = new Set<string>();
  for (const path of ALWAYS_READS) {
    const hit = fields.get(path);
    if (hit) inputKeys.add(hit.ref.key);
  }
  for (const w of all) {
    for (const path of writerFields(w)) {
      const hit = fields.get(path);
      if (!hit) continue;
      inputKeys.add(hit.ref.key);
      addEdge(hit.ref.key, w.id);
    }
    for (const need of writerNeeds(w)) addEdge(nodeIdFor(need), w.id);
  }

  const children = new Map<string, string[]>();
  for (const [a, b] of edges.values()) children.set(a, [...(children.get(a) ?? []), b]);
  const outputIds = new Set(BLUEPRINT_OUTPUTS.map((o) => o.id));
  const reachOf = (id: string) => {
    const seen = new Set<string>();
    const queue = [...(children.get(id) ?? [])];
    while (queue.length) {
      const next = queue.shift() as string;
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(...(children.get(next) ?? []));
    }
    return [...seen].filter((n) => outputIds.has(n)).length;
  };

  const inputs: FlowNode[] = BLUEPRINT_SECTIONS.filter((ref) => inputKeys.has(ref.key)).map((ref) => {
    const own = (ref.section.fields ?? []).map((f) => ({ path: f.path, label: f.label, required: Boolean(f.required) }));
    return {
      id: ref.key,
      kind: ref.section.source === "imported" ? "import" : RESEARCHABLE.has(ref.key) ? "research" : "coach",
      label: ref.section.title,
      page: ref.page.slug,
      sectionKey: ref.key,
      about: ref.section.about ?? null,
      fields: own,
      everyWriter: own.some((f) => ALWAYS_READS.includes(f.path as FieldSpec["path"])),
      writer: null,
      reach: Math.max(0, ...own.map((f) => answerReach(f.path))),
    };
  });

  const written: FlowNode[] = all.map((w) => {
    const key = w.ref?.section.source === "we_build" ? w.ref.key : null;
    const skill = key ? SECTION_SKILLS[key] : undefined;
    const contract = key ? writerContract(key) : null;
    const needs = writerNeeds(w);
    const sources = contract
      ? [...contract.sources]
      : (w.output?.uses?.sources ?? []);
    const builtOn = needs.map(nodeIdFor);
    const alsoReads = key && skill ? writerUpstream(key).filter((k) => !needs.includes(k)).map(nodeIdFor) : [];
    return {
      id: w.id,
      kind: w.output ? "out" : "build",
      label: w.output?.title ?? w.ref?.section.title ?? w.id,
      page: w.ref?.page.slug ?? null,
      sectionKey: w.ref?.key ?? null,
      about: w.ref?.section.about ?? null,
      fields: [],
      everyWriter: false,
      writer: {
        reads: writerFields(w),
        sources: sources.map((s) => SOURCE_LABELS[s]),
        builtOn,
        alsoReads,
        readsAll: Boolean(w.output?.readsAll),
        method: w.output?.method ?? (skill ? `content/practice-skills/${skill.file}` : null),
        task: skill?.task ?? null,
        signOff: w.output?.signOff ?? (key ? "The coach" : null),
        goesTo: w.output?.goesTo ?? (w.ref?.section.feeds ?? null),
        sendsToGetClients: Boolean(key && handoffForSection(key)),
        preview: skill ? "section" : w.id === "linkedin" ? "linkedin" : w.output?.readsAll ? "summary" : null,
      },
      reach: reachOf(w.id),
    };
  });

  return { nodes: [...inputs, ...written], edges: [...edges.values()], outputCount: outputIds.size, shared: SHARED };
}

export type FlowNodeStatus = {
  /** filled / open for answers; written / ready / missing for everything BCA writes. */
  state: "filled" | "open" | "written" | "ready" | "missing";
  /** Required answers still empty: this section's own, or everything under a writer. */
  answers: string[];
  /** Written sections under it that are not written yet. */
  sections: string[];
  /** Answers: which of this section's fields are filled. */
  filled?: string[];
};

/** Where one coach stands on every node: what is filled, written, and what is missing. */
export function flowStatus(row: PracticeKnowledgeRow): Record<string, FlowNodeStatus> {
  const fields = fieldIndex();
  const graph = flowGraph();
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const out: Record<string, FlowNodeStatus> = {};

  const emptyRequired = (paths: Iterable<string>) => {
    const labels: string[] = [];
    for (const path of paths) {
      const hit = fields.get(path);
      if (hit?.field.required && !fieldFilled(row.payload, hit.field)) labels.push(`${hit.ref.section.title}: ${hit.field.label}`);
    }
    return labels;
  };

  for (const node of graph.nodes) {
    if (!node.writer) {
      const ref = node.sectionKey ? sectionByKey(node.sectionKey) : null;
      const specs = ref?.section.fields ?? [];
      const filled = specs.filter((f) => fieldFilled(row.payload, f)).map((f) => f.path);
      const missing = specs.filter((f) => f.required && !filled.includes(f.path)).map((f) => f.label);
      out[node.id] = { state: missing.length ? "open" : "filled", answers: missing, sections: [], filled };
      continue;
    }
    // Everything under it: its own answers, and the answers and sections under what it is built on.
    const reads = new Set<string>([...ALWAYS_READS, ...node.writer.reads]);
    const unwritten = new Set<string>();
    const visit = (id: string, seen: Set<string>) => {
      if (seen.has(id)) return;
      seen.add(id);
      const dep = byId.get(id);
      if (!dep?.writer) return;
      if (dep.sectionKey && sectionByKey(dep.sectionKey)?.section.source === "we_build") {
        for (const path of sectionReads(dep.sectionKey)) reads.add(path);
        if (!row.built_sections[dep.sectionKey]) unwritten.add(dep.label);
      }
      dep.writer.builtOn.forEach((next) => visit(next, seen));
    };
    const seen = new Set<string>([node.id]);
    node.writer.builtOn.forEach((id) => visit(id, seen));
    const answers = emptyRequired(reads);
    const sections = [...unwritten];
    // Outputs written outside the Blueprint (LinkedIn, the website, the AI tools) are ready or missing, never "written".
    const ownSection = node.sectionKey ? sectionByKey(node.sectionKey)?.section : undefined;
    const written = Boolean(ownSection?.source === "we_build" && row.built_sections[node.sectionKey as string]);
    out[node.id] = { state: written ? "written" : answers.length || sections.length ? "missing" : "ready", answers, sections };
  }
  return out;
}
