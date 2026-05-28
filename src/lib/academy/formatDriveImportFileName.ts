/** Display helpers for Drive import file paths (client-safe). */

const RAW_UUID =
  /[-_]?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

const SMALL_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "vs",
  "it",
  "to",
  "of",
  "in",
  "for",
  "on",
  "at",
  "by",
]);

function humanizeWords(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index > 0 && SMALL_WORDS.has(lower)) return lower;
      if (word.length <= 3 && word === word.toUpperCase()) return word;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function humanizeSegment(segment: string): string {
  const trimmed = segment.trim();
  if (!trimmed) return "";

  const numbered = trimmed.match(/^(\d+)[_.](\d+)[_.](.+)$/);
  if (numbered) {
    const rest = humanizeWords(numbered[3]!.replace(/_/g, " "));
    return rest ? `${numbered[1]}.${numbered[2]} ${rest}` : `${numbered[1]}.${numbered[2]}`;
  }

  const singleNumber = trimmed.match(/^(\d+)[_.](.+)$/);
  if (singleNumber) {
    return `${singleNumber[1]}. ${humanizeWords(singleNumber[2]!.replace(/_/g, " "))}`;
  }

  return humanizeWords(trimmed.replace(/_/g, " "));
}

function logicalBaseName(fileName: string): string {
  let base = fileName;
  if (base.toLowerCase().endsWith(".mp4.docx")) {
    base = base.slice(0, -".docx".length);
  }
  const ext = base.includes(".") ? base.slice(base.lastIndexOf(".")) : "";
  if (/\.(mp4|mov|webm|m4v|txt|md|docx|srt|vtt)$/i.test(ext)) {
    base = base.slice(0, -ext.length);
  }
  base = base.replace(RAW_UUID, "");
  base = base.replace(/\s*\(\s*1\s*\)\s*$/i, "");
  return base.replace(/_+$/g, "").trim();
}

export type DriveImportFileDisplay = {
  title: string;
  folder: string;
  fileName: string;
  fullPath: string;
};

/** Turn `1_3_Use_it_or_Lose_It__Knowledge_vs_action__uuid.mp4.docx` into readable text. */
export function formatDriveImportFileDisplay(relativePath: string): DriveImportFileDisplay {
  const fullPath = relativePath.replace(/\\/g, "/");
  const parts = fullPath.split("/");
  const fileName = parts.pop() ?? fullPath;
  const folder = parts.join("/");

  const base = logicalBaseName(fileName);
  const segments = base
    .split("__")
    .map((s) => s.trim())
    .filter(Boolean);
  const title =
    segments.length > 0
      ? segments.map(humanizeSegment).filter(Boolean).join(" — ")
      : humanizeWords(base.replace(/_/g, " "));

  return {
    title: title || fileName,
    folder,
    fileName,
    fullPath,
  };
}
