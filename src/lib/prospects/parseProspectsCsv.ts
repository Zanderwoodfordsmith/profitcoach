import {
  MAX_PROSPECT_IMPORT_CSV_CHARS,
  MAX_PROSPECT_IMPORT_FIELD,
  MAX_PROSPECT_IMPORT_ROWS,
} from "@/lib/prospects/importLimits";

export type ParsedProspectCsvRow = {
  fullName: string;
  email: string | null;
  phone: string | null;
  businessName: string | null;
  jobTitle: string | null;
  linkedinUrl: string | null;
};

export const PROSPECTS_CSV_TEMPLATE = `Name,Title,Business,Email,Phone,LinkedIn
Jane Example,Founder,Example Ltd,jane@example.com,+44 7700 900000,https://www.linkedin.com/in/jane-example
`;

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

function normHeader(value: string): string {
  return value.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[_-]+/g, " ");
}

function headerIndex(headers: string[], aliases: string[]): number {
  return headers.findIndex((h) => aliases.includes(h));
}

function cell(row: string[], index: number): string | null {
  if (index < 0) return null;
  const value = (row[index] ?? "").trim();
  if (!value) return null;
  return value.slice(0, MAX_PROSPECT_IMPORT_FIELD);
}

export function parseProspectsCsv(
  text: string,
  opts?: { maxRows?: number }
): ParsedProspectCsvRow[] {
  const maxRows = opts?.maxRows ?? MAX_PROSPECT_IMPORT_ROWS;
  if (text.length > MAX_PROSPECT_IMPORT_CSV_CHARS) {
    throw new Error(`CSV is too large. Please import ${maxRows} rows or fewer.`);
  }

  const records = parseCsvRecords(text.replace(/^\uFEFF/, ""));
  if (records.length < 2) {
    throw new Error("CSV needs a header row and at least one prospect.");
  }

  const headers = records[0].map(normHeader);
  const iName = headerIndex(headers, ["name", "full name", "full name"]);
  const iFirst = headerIndex(headers, ["first name", "first"]);
  const iLast = headerIndex(headers, ["last name", "last"]);
  const iEmail = headerIndex(headers, ["email", "email address", "e mail"]);
  const iPhone = headerIndex(headers, ["phone", "mobile", "telephone", "phone number"]);
  const iBusiness = headerIndex(headers, ["business", "company", "business name", "company name"]);
  const iTitle = headerIndex(headers, ["title", "job title", "position"]);
  const iLinkedIn = headerIndex(headers, ["linkedin", "linkedin url", "url", "profile url"]);

  if (iName < 0 && iFirst < 0) {
    throw new Error("CSV needs a Name column, or First Name / Last Name.");
  }

  const rows: ParsedProspectCsvRow[] = [];
  for (const record of records.slice(1)) {
    if (record.every((c) => !c.trim())) continue;
    const first = cell(record, iFirst) ?? "";
    const last = cell(record, iLast) ?? "";
    const fullName =
      cell(record, iName) ||
      [first, last].filter(Boolean).join(" ").trim();
    if (!fullName) continue;
    rows.push({
      fullName,
      email: cell(record, iEmail),
      phone: cell(record, iPhone),
      businessName: cell(record, iBusiness),
      jobTitle: cell(record, iTitle),
      linkedinUrl: cell(record, iLinkedIn),
    });
    if (rows.length > maxRows) {
      throw new Error(`CSV has more than ${maxRows} prospects.`);
    }
  }

  if (rows.length === 0) {
    throw new Error("No prospects found in that CSV.");
  }
  return rows;
}
