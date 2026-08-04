import type { ParsedLinkedInConnection } from "./types";
import { ICP_TITLE_KEYWORDS } from "./types";

/**
 * Parse LinkedIn Basic export Connections.csv (notes block before header).
 */
export function parseConnectionsCsv(text: string): ParsedLinkedInConnection[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const headerIdx = lines.findIndex(
    (l) =>
      l.includes("First Name") &&
      l.includes("Company") &&
      (l.includes("Position") || l.includes("URL"))
  );
  if (headerIdx < 0) {
    throw new Error(
      "Could not find Connections.csv header (First Name, Company, …)."
    );
  }

  const rows = parseCsvRecords(lines.slice(headerIdx).join("\n"));
  if (rows.length === 0) return [];

  const header = rows[0].map((h) => h.trim());
  const idx = (name: string) =>
    header.findIndex((h) => h.toLowerCase() === name.toLowerCase());

  const iFirst = idx("First Name");
  const iLast = idx("Last Name");
  const iUrl = idx("URL");
  const iEmail = idx("Email Address");
  const iCompany = idx("Company");
  const iPosition = idx("Position");
  const iConnected = idx("Connected On");

  if (iFirst < 0 || iCompany < 0) {
    throw new Error("Connections.csv is missing required columns.");
  }

  const out: ParsedLinkedInConnection[] = [];
  for (const row of rows.slice(1)) {
    if (row.every((c) => !c.trim())) continue;
    const firstName = (row[iFirst] ?? "").trim();
    const lastName = iLast >= 0 ? (row[iLast] ?? "").trim() : "";
    if (!firstName && !lastName) continue;
    out.push({
      firstName,
      lastName,
      linkedinUrl: iUrl >= 0 ? normalizeLinkedInUrl(row[iUrl] ?? "") : "",
      email: iEmail >= 0 ? (row[iEmail] ?? "").trim() : "",
      company: (row[iCompany] ?? "").trim(),
      position: iPosition >= 0 ? (row[iPosition] ?? "").trim() : "",
      connectedOn: iConnected >= 0 ? (row[iConnected] ?? "").trim() : "",
    });
  }
  return out;
}

export function matchConnectionTitles(
  position: string,
  extraKeywords: string[] = []
): { matched: boolean; matchedTitles: string[] } {
  const pos = ` ${position.toLowerCase()} `;
  const matchedTitles: string[] = [];
  const keywords = [
    ...ICP_TITLE_KEYWORDS,
    ...extraKeywords.map((k) => k.toLowerCase().trim()).filter(Boolean),
  ];
  for (const k of keywords) {
    const needle = k.trim().toLowerCase();
    if (!needle) continue;
    if (pos.includes(` ${needle} `) || pos.includes(needle)) {
      if (!matchedTitles.includes(needle)) matchedTitles.push(needle);
    }
  }
  // Avoid false positives: lone "md" only when word-ish
  return { matched: matchedTitles.length > 0, matchedTitles };
}

function normalizeLinkedInUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  try {
    const u = new URL(t.startsWith("http") ? t : `https://${t}`);
    u.hash = "";
    u.search = "";
    const path = u.pathname.replace(/\/+$/, "");
    return `${u.origin}${path}`.toLowerCase();
  } catch {
    return t.toLowerCase();
  }
}

/** Minimal CSV parser supporting quoted fields and newlines inside quotes. */
function parseCsvRecords(text: string): string[][] {
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (c === "\n") {
      row.push(field);
      records.push(row);
      row = [];
      field = "";
      continue;
    }
    if (c === "\r") continue;
    field += c;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    records.push(row);
  }
  return records;
}
