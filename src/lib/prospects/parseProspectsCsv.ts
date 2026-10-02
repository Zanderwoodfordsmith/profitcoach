import {
  applyCsvColumnMap,
  guessCsvColumnMap,
  readCsvForMatching,
} from "@/lib/prospects/csvColumnMatch";

export type ParsedProspectCsvRow = {
  fullName: string;
  email: string | null;
  phone: string | null;
  businessName: string | null;
  jobTitle: string | null;
  linkedinUrl: string | null;
  website?: string | null;
  location?: string | null;
  city?: string | null;
  postcode?: string | null;
  address?: string | null;
};

export const PROSPECTS_CSV_TEMPLATE = `Name,Title,Business,Email,Phone,LinkedIn,Website,Town,Postcode
Jane Example,Founder,Example Ltd,jane@example.com,+44 7700 900000,https://www.linkedin.com/in/jane-example,https://example.com,Leeds,LS1 4AP
`;

/** Guess columns, then read rows. A bad LinkedIn cell is kept for the importer to ignore. */
export function parseProspectsCsv(
  text: string,
  opts?: { maxRows?: number }
): ParsedProspectCsvRow[] {
  const preview = readCsvForMatching(text, opts);
  return applyCsvColumnMap(text, guessCsvColumnMap(preview.headers), opts);
}
