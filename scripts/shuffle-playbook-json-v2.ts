/**
 * Shuffle content/playbooks/*.json to match methodology v2 playbook placement.
 * Refs are grid cell IDs; JSON content moves with playbook identity.
 *
 * Run: npx tsx scripts/shuffle-playbook-json-v2.ts
 */

import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { AREAS, LEVELS } from "../src/lib/bossData";
import {
  V1_PLAYBOOK_BY_REF,
  V2_PLAYBOOK_BY_REF,
} from "../src/lib/bossMethodologyMigration";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLAYBOOK_DIR = path.join(__dirname, "..", "content", "playbooks");
const REPO_ROOT = path.join(__dirname, "..");

type PlaybookJson = {
  ref: string;
  level: number;
  area: number;
  name: string;
  subtitle: string;
  whatThisIs: string;
  [key: string]: unknown;
};

function levelLabel(levelId: number): string {
  return LEVELS.find((l) => l.id === levelId)?.name ?? `Level ${levelId}`;
}

function areaName(areaId: number): string {
  return AREAS.find((a) => a.id === areaId)?.name ?? "";
}

function subtitleFor(level: number, areaId: number): string {
  return `Level ${level} · ${levelLabel(level)} · ${areaName(areaId)}`;
}

/** v2 ref → v1 ref (original methodology v1 content) */
const V2_TO_V1_SOURCE: Record<string, string> = {
  "1.2": "1.5",
  "2.2": "1.2",
  "3.2": "2.2",
  "1.5": "2.5",
  "2.5": "4.5",
  "3.5": "3.2",
  "4.5": "3.5",
  "5.5": "5.5",
};

function sourceV1RefForV2(v2Ref: string): string {
  if (V2_TO_V1_SOURCE[v2Ref]) return V2_TO_V1_SOURCE[v2Ref];

  const v2Name = V2_PLAYBOOK_BY_REF[v2Ref];
  if (!v2Name) return v2Ref;

  for (const [ref, name] of Object.entries(V1_PLAYBOOK_BY_REF)) {
    if (name === v2Name) return ref;
  }

  if (v2Name === "Team Output") return "1.9";

  return v2Ref;
}

function loadV1FromGit(ref: string): PlaybookJson | null {
  try {
    const raw = execSync(`git show HEAD:content/playbooks/${ref}.json`, {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    });
    return JSON.parse(raw) as PlaybookJson;
  } catch {
    return null;
  }
}

function main() {
  const byV1Ref = new Map<string, PlaybookJson>();

  for (const ref of new Set([
    ...Object.keys(V1_PLAYBOOK_BY_REF),
    ...Object.values(V2_TO_V1_SOURCE),
  ])) {
    const fromGit = loadV1FromGit(ref);
    if (fromGit) {
      byV1Ref.set(ref, fromGit);
      continue;
    }
    const diskPath = path.join(PLAYBOOK_DIR, `${ref}.json`);
    if (fs.existsSync(diskPath)) {
      byV1Ref.set(ref, JSON.parse(fs.readFileSync(diskPath, "utf8")) as PlaybookJson);
    }
  }

  const v2Refs = Object.keys(V2_PLAYBOOK_BY_REF).sort(
    (a, b) => parseFloat(a) - parseFloat(b)
  );

  for (const v2Ref of v2Refs) {
    const [levelStr, areaStr] = v2Ref.split(".");
    const level = Number(levelStr);
    const area = Number(areaStr);
    const v2Name = V2_PLAYBOOK_BY_REF[v2Ref];
    const v1SourceRef = sourceV1RefForV2(v2Ref);
    const source = byV1Ref.get(v1SourceRef);
    if (!source) {
      console.warn(`Missing source for ${v2Ref} (${v2Name}) from v1 ${v1SourceRef}`);
      continue;
    }

    const doc: PlaybookJson = {
      ...structuredClone(source),
      ref: v2Ref,
      level,
      area,
      name: v2Name,
      subtitle: subtitleFor(level, area),
    };

    if (v2Ref === "1.2") {
      doc.whatThisIs = doc.whatThisIs.replace(
        /Revenue & Marketing/g,
        "Defined Strategy"
      );
    }
    if (v2Ref === "3.5") {
      doc.whatThisIs = doc.whatThisIs.replace(
        /Defined Strategy|Clarify Vision/gi,
        "Revenue & Marketing"
      );
    }

    const outPath = path.join(PLAYBOOK_DIR, `${v2Ref}.json`);
    fs.writeFileSync(outPath, JSON.stringify(doc, null, 2) + "\n", "utf8");
  }

  console.log(`Updated ${v2Refs.length} playbook JSON files for methodology v2.`);
}

main();
