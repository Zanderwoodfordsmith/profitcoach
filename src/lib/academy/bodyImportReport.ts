import fs from "node:fs";
import path from "node:path";

export type AcademyBodyImportReportRow = {
  title: string;
  sourceFile: string;
  sourceLine: number;
  kind: "override" | "matched" | "ambiguous" | "unmatched";
  target: { courseId: string; lessonId: string } | null;
  score: number;
  candidates?: Array<{ lessonId: string; score: number }>;
  existingBody: boolean | null;
  bodyChars: number;
  imageCount?: number;
};

export type AcademyBodyImportUnresolved = {
  reportFile: string | null;
  unresolved: AcademyBodyImportReportRow[];
  totalRows: number;
};

const REPORT_DIR = path.join(process.cwd(), "reports");
const REPORT_PREFIX = "academy-body-import-";
const REPORT_SUFFIX = ".json";

/** Load unresolved (ambiguous/unmatched) rows from the latest body import report. */
export function loadLatestAcademyBodyImportUnresolved(): AcademyBodyImportUnresolved {
  if (!fs.existsSync(REPORT_DIR)) {
    return { reportFile: null, unresolved: [], totalRows: 0 };
  }

  const reportFile = fs
    .readdirSync(REPORT_DIR)
    .filter((f) => f.startsWith(REPORT_PREFIX) && f.endsWith(REPORT_SUFFIX))
    .sort((a, b) => b.localeCompare(a))[0];

  if (!reportFile) {
    return { reportFile: null, unresolved: [], totalRows: 0 };
  }

  const filePath = path.join(REPORT_DIR, reportFile);
  const raw = fs.readFileSync(filePath, "utf8");
  const rows = JSON.parse(raw) as AcademyBodyImportReportRow[];
  const unresolved = rows.filter((r) => r.kind === "ambiguous" || r.kind === "unmatched");
  return { reportFile, unresolved, totalRows: rows.length };
}

