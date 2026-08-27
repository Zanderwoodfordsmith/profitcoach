import type { SalesNavImportedLead } from "@/lib/apify/salesNavigatorTypes";
import {
  buildCsvContent,
  csvFilenameStem,
  downloadCsvFile,
} from "@/lib/exportCsv";

export const SALES_NAV_LEAD_CSV_HEADERS = [
  "full_name",
  "first_name",
  "last_name",
  "job_title",
  "company",
  "linkedin_url",
  "location",
  "email",
  "headline",
  "about",
  "tenure",
  "photo_url",
] as const;

export function salesNavLeadsToCsvRows(
  leads: SalesNavImportedLead[]
): (string | null)[][] {
  return leads.map((l) => [
    l.fullName,
    l.firstName,
    l.lastName,
    l.jobTitle,
    l.company,
    l.linkedinUrl,
    l.location,
    l.email,
    l.headline,
    l.about,
    l.tenureLabel,
    l.photoUrl,
  ]);
}

export function buildSalesNavLeadsCsv(leads: SalesNavImportedLead[]): string {
  return buildCsvContent(
    [...SALES_NAV_LEAD_CSV_HEADERS],
    salesNavLeadsToCsvRows(leads)
  );
}

export function salesNavExportFilename(name?: string | null): string {
  const slug = name?.trim()
    ? name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80)
    : "";
  return `${csvFilenameStem(slug || "sales-nav-import")}.csv`;
}

export function downloadSalesNavLeadsCsv(
  leads: SalesNavImportedLead[],
  opts?: { name?: string | null }
): void {
  if (!leads.length) return;
  downloadCsvFile(
    salesNavExportFilename(opts?.name),
    buildSalesNavLeadsCsv(leads)
  );
}
