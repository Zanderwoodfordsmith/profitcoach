/**
 * Turn rows pasted from Excel / Google Sheets (tabs) or a CSV into client rows
 * for the bulk import. The first row must be headers; common wordings map to
 * our fields. UK dates (dd/mm/yyyy) become yyyy-mm-dd.
 */

export const PASTE_TEMPLATE_HEADERS = [
  "Name",
  "Business",
  "LinkedIn URL",
  "Joined (dd/mm/yyyy)",
  "Monthly fee",
  "Sector",
  "Turnover",
  "Team size",
  "How they found you",
  "Result you got",
  "Fit 1-5",
  "Notes",
] as const;

const HEADER_MAP: [RegExp, string][] = [
  [/^(full ?name|name|client|client name|person)$/, "fullName"],
  [/^(business|company|business name|company name|organisation|organization)$/, "businessName"],
  [/linkedin/, "linkedinUrl"],
  [/^(joined|start|started|join date|start date|date joined)/, "joinedOn"],
  [/(fee|price|monthly|retainer)/, "feeAmount"],
  [/^(sector|industry|trade|market)/, "sector"],
  [/(turnover|revenue)/, "revenueBand"],
  [/(team|staff|employees|headcount|people)/, "teamSize"],
  [/(source|found|how they|channel|lead source)/, "source"],
  [/(result|outcome|achieved)/, "result"],
  [/(fit|rating|score|ideal)/, "fit"],
  [/(note|problem)/, "problemNotes"],
];

function splitLine(line: string, sep: string): string[] {
  if (sep === "\t") return line.split("\t");
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

export function ukDateToIso(value: string): string {
  const v = value.trim();
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(v);
  if (!m) return v;
  const year = m[3]!.length === 2 ? `20${m[3]}` : m[3]!;
  return `${year}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
}

export function parsePastedClients(text: string): { rows: Record<string, string>[]; unknownHeaders: string[]; error: string | null } {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim());
  if (lines.length < 2) return { rows: [], unknownHeaders: [], error: "Paste a header row and at least one client." };
  const sep = lines[0]!.includes("\t") ? "\t" : ",";
  const headers = splitLine(lines[0]!, sep).map((h) => h.trim().toLowerCase());
  const fields = headers.map((h) => HEADER_MAP.find(([re]) => re.test(h))?.[1] ?? null);
  if (!fields.includes("fullName")) return { rows: [], unknownHeaders: [], error: 'Add a "Name" column.' };
  const unknownHeaders = headers.filter((h, i) => h && !fields[i]);
  const rows: Record<string, string>[] = [];
  for (const line of lines.slice(1)) {
    const cells = splitLine(line, sep);
    const row: Record<string, string> = {};
    fields.forEach((field, i) => {
      if (!field) return;
      const value = (cells[i] ?? "").trim();
      if (!value) return;
      row[field] = field === "joinedOn" ? ukDateToIso(value) : value;
    });
    if (row.fullName) rows.push(row);
  }
  return { rows, unknownHeaders, error: rows.length ? null : "No rows with a name found." };
}
