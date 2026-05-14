/**
 * Writes CSV of the 50 BOSS / Profit System diagnostic questions with playbook refs,
 * scoring guides, and structure — for members (Google Sheets / Drive).
 *
 * Run: npx tsx scripts/export-boss-methodology-questions-csv.ts
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { ASSESSMENT_QUESTIONS } from "../src/lib/assessmentQuestions";
import { LEVELS } from "../src/lib/bossData";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function csvCell(value: string): string {
  const s = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function levelName(levelId: number): string {
  return LEVELS.find((l) => l.id === levelId)?.name ?? String(levelId);
}

function main() {
  const outDir = path.join(__dirname, "..", "exports");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "profit-system-methodology-50-questions.csv");

  const headers = [
    "row",
    "playbook_ref",
    "playbook_name",
    "boss_level",
    "boss_level_name",
    "area",
    "area_code",
    "pillar",
    "assessment_page",
    "question_number_on_page",
    "question",
    "score_red",
    "score_amber",
    "score_green",
  ];

  const lines = [headers.join(",")];

  ASSESSMENT_QUESTIONS.forEach((q, i) => {
    const row = [
      String(i + 1),
      q.ref,
      q.playbook,
      String(q.level),
      levelName(q.level),
      q.area,
      q.areaCode,
      q.pillar,
      String(q.page),
      String(q.questionNumberOnPage),
      q.question,
      q.scoringGuide.red,
      q.scoringGuide.amber,
      q.scoringGuide.green,
    ].map(csvCell);
    lines.push(row.join(","));
  });

  fs.writeFileSync(outPath, lines.join("\n") + "\n", "utf8");
  console.log(`Wrote ${ASSESSMENT_QUESTIONS.length} rows to ${outPath}`);
}

main();
