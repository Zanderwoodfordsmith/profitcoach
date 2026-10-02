import {
  MAX_PROSPECT_IMPORT_CSV_CHARS,
  MAX_PROSPECT_IMPORT_FIELD,
  MAX_PROSPECT_IMPORT_ROWS,
} from "@/lib/prospects/importLimits";
import type { ParsedProspectCsvRow } from "@/lib/prospects/parseProspectsCsv";

export const CSV_MATCH_FIELDS = [
  {
    id: "name",
    label: "Name",
    aliases: ["full name", "contact name", "name"],
  },
  {
    id: "firstName",
    label: "First name",
    aliases: ["first name", "firstname", "given name", "first"],
  },
  {
    id: "lastName",
    label: "Last name",
    aliases: ["last name", "lastname", "surname", "family name", "last"],
  },
  {
    id: "jobTitle",
    label: "Job title",
    aliases: ["job title", "position", "title"],
  },
  {
    id: "business",
    label: "Business",
    aliases: ["business name", "company name", "company", "business", "organisation", "organization"],
  },
  {
    id: "email",
    label: "Email",
    aliases: ["email address", "e mail", "email"],
  },
  {
    id: "phone",
    label: "Phone",
    aliases: ["phone number", "mobile number", "telephone", "mobile", "phone", "tel"],
  },
  {
    id: "linkedin",
    label: "LinkedIn URL",
    aliases: ["linkedin url", "linkedin profile", "profile url", "linkedin", "url"],
  },
  {
    id: "website",
    label: "Website",
    aliases: ["company website", "web site", "website", "web"],
  },
  {
    id: "location",
    label: "Location",
    aliases: ["location"],
  },
  {
    id: "city",
    label: "Town / city",
    aliases: ["town / city", "town", "city"],
  },
  {
    id: "postcode",
    label: "Postcode",
    aliases: ["postal code", "post code", "postcode", "zip code", "zip"],
  },
  {
    id: "address",
    label: "Address",
    aliases: ["street address", "address"],
  },
] as const;

export type CsvMatchFieldId = (typeof CSV_MATCH_FIELDS)[number]["id"];
export type CsvColumnChoice = CsvMatchFieldId | "skip";
export type CsvColumnMapping = CsvColumnChoice[];

export type CsvMatchPreview = {
  headers: string[];
  /** Up to three sample values per column. */
  samples: string[][];
  rowCount: number;
};

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

export function normCsvHeader(value: string): string {
  return value.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[_-]+/g, " ");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function headerMatches(header: string, alias: string): boolean {
  if (header === alias) return true;
  const pattern = new RegExp(`(?:^| )${escapeRegExp(alias)}(?: |$)`);
  return pattern.test(header);
}

export function guessCsvColumnMap(headers: string[]): CsvColumnMapping {
  const used = new Set<CsvMatchFieldId>();
  return headers.map((header) => {
    const normalized = normCsvHeader(header);
    if (!normalized) return "skip";
    let best: { id: CsvMatchFieldId; length: number } | null = null;
    for (const field of CSV_MATCH_FIELDS) {
      if (used.has(field.id)) continue;
      for (const alias of field.aliases) {
        if (!headerMatches(normalized, alias)) continue;
        if (!best || alias.length > best.length) {
          best = { id: field.id, length: alias.length };
        }
      }
    }
    if (!best) return "skip";
    used.add(best.id);
    return best.id;
  });
}

function cell(row: string[], index: number): string | null {
  const value = (row[index] ?? "").trim();
  if (!value) return null;
  return value.slice(0, MAX_PROSPECT_IMPORT_FIELD);
}

export function readCsvForMatching(
  text: string,
  opts?: { maxRows?: number }
): CsvMatchPreview {
  const maxRows = opts?.maxRows ?? MAX_PROSPECT_IMPORT_ROWS;
  if (text.length > MAX_PROSPECT_IMPORT_CSV_CHARS) {
    throw new Error(`CSV is too large. Please import ${maxRows} rows or fewer.`);
  }
  const records = parseCsvRecords(text.replace(/^\uFEFF/, ""));
  if (records.length < 2) {
    throw new Error("CSV needs a header row and at least one person.");
  }
  const width = records[0]?.length ?? 0;
  if (!width) throw new Error("CSV needs a header row and at least one person.");
  const headers = records[0].map((header, index) => {
    const label = header.replace(/^\uFEFF/, "").trim();
    return label || `Column ${index + 1}`;
  });
  const data = records.slice(1).filter((row) => row.some((value) => value.trim()));
  if (!data.length) throw new Error("CSV needs a header row and at least one person.");
  if (data.length > maxRows) {
    throw new Error(`CSV has more than ${maxRows} people.`);
  }
  const samples = headers.map((_, index) =>
    data
      .map((row) => (row[index] ?? "").trim())
      .filter(Boolean)
      .slice(0, 3)
  );
  return { headers, samples, rowCount: data.length };
}

export function applyCsvColumnMap(
  text: string,
  mapping: CsvColumnMapping,
  opts?: { maxRows?: number }
): ParsedProspectCsvRow[] {
  const maxRows = opts?.maxRows ?? MAX_PROSPECT_IMPORT_ROWS;
  const records = parseCsvRecords(text.replace(/^\uFEFF/, ""));
  if (records.length < 2) {
    throw new Error("CSV needs a header row and at least one person.");
  }
  const indexOf = (field: CsvMatchFieldId) => mapping.indexOf(field);
  const iName = indexOf("name");
  const iFirst = indexOf("firstName");
  const iLast = indexOf("lastName");
  if (iName < 0 && iFirst < 0) {
    throw new Error("Match a Name column, or First name.");
  }

  const rows: ParsedProspectCsvRow[] = [];
  for (const record of records.slice(1)) {
    if (record.every((value) => !value.trim())) continue;
    const first = cell(record, iFirst) ?? "";
    const last = cell(record, iLast) ?? "";
    const fullName =
      cell(record, iName) || [first, last].filter(Boolean).join(" ").trim();
    if (!fullName) continue;
    rows.push({
      fullName,
      email: cell(record, indexOf("email")),
      phone: cell(record, indexOf("phone")),
      businessName: cell(record, indexOf("business")),
      jobTitle: cell(record, indexOf("jobTitle")),
      linkedinUrl: cell(record, indexOf("linkedin")),
      website: cell(record, indexOf("website")),
      location: cell(record, indexOf("location")),
      city: cell(record, indexOf("city")),
      postcode: cell(record, indexOf("postcode")),
      address: cell(record, indexOf("address")),
    });
    if (rows.length > maxRows) {
      throw new Error(`CSV has more than ${maxRows} people.`);
    }
  }
  if (!rows.length) {
    throw new Error("No people found. Match a Name column, or First name.");
  }
  return rows;
}
