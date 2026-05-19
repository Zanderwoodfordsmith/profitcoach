import type { SupabaseClient } from "@supabase/supabase-js";
import { parse } from "csv-parse/sync";

import { paymentImportSkipReason } from "@/lib/paymentImportFilters";
import {
  loadCoachDirectory,
  upsertCoachPaymentFromCsv,
  type CoachDirectory,
  type CsvPaymentStatus,
} from "@/lib/stripePaymentsSync";

export type RevolutCsvImportOptions = {
  dryRun?: boolean;
  includeFailed?: boolean;
};

export type RevolutCsvImportResult = {
  processed: number;
  imported: number;
  skipped: number;
  failed: number;
  matched: number;
  unmatched: number;
  skippedReasons: Record<string, number>;
  byStatus: Record<string, number>;
  errors: Array<{ row: number; message: string }>;
};

type ParsedRevolutRow = {
  rowNumber: number;
  importRowKey: string;
  customerEmail: string;
  amountCents: number;
  currency: string;
  status: CsvPaymentStatus;
  paidAtIso: string;
  description: string;
  declineReason: string | null;
};

const EMAIL_IN_TEXT = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

export function emailFromRevolutDescription(description: string): string | null {
  const trimmed = description.trim();
  if (!trimmed) return null;

  const settlementPrefix = /^settlement\s+for\s+(.+)$/i.exec(trimmed);
  if (settlementPrefix) {
    const candidate = settlementPrefix[1].trim().toLowerCase();
    if (EMAIL_IN_TEXT.test(candidate)) {
      const match = candidate.match(EMAIL_IN_TEXT);
      return match ? match[0].toLowerCase() : null;
    }
  }

  const match = trimmed.match(EMAIL_IN_TEXT);
  return match ? match[0].toLowerCase() : null;
}

function parseAmountCents(amountRaw: string | undefined): number | null {
  const cleaned = String(amountRaw ?? "").replace(/,/g, "").trim();
  if (!cleaned) return null;
  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}

function parseRevolutUtcDateTime(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const revolutMatch = /^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{2}):(\d{2})$/.exec(trimmed);
  if (revolutMatch) {
    const [, date, hour, minute, second] = revolutMatch;
    const iso = `${date}T${hour.padStart(2, "0")}:${minute}:${second}Z`;
    const parsed = Date.parse(iso);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }

  const normalized = trimmed.replace(" ", "T");
  const iso = normalized.includes("Z") ? normalized : `${normalized}Z`;
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}

function parsePaidAtIso(completedRaw: string | undefined, startedRaw: string | undefined): string | null {
  const completed = completedRaw?.trim() ?? "";
  const started = startedRaw?.trim() ?? "";
  return parseRevolutUtcDateTime(completed) ?? parseRevolutUtcDateTime(started);
}

function mapRevolutStatus(state: string): CsvPaymentStatus | null {
  switch (state.trim().toUpperCase()) {
    case "COMPLETED":
      return "succeeded";
    case "DECLINED":
    case "FAILED":
      return "failed";
    default:
      return null;
  }
}

export function parseRevolutMerchantPaymentsCsv(
  csvText: string,
  options?: RevolutCsvImportOptions
): { rows: ParsedRevolutRow[]; skipped: number; skippedReasons: Record<string, number> } {
  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  }) as Record<string, string>[];

  const rows: ParsedRevolutRow[] = [];
  let skipped = 0;
  const skippedReasons: Record<string, number> = {};

  const bumpSkip = (reason: string) => {
    skipped += 1;
    skippedReasons[reason] = (skippedReasons[reason] ?? 0) + 1;
  };

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const rowNumber = index + 2;
    const type = (record.Type ?? "").trim();

    if (type !== "Settlement") {
      bumpSkip(type === "Reserve" ? "reserve_internal" : type === "Topup" ? "topup" : "not_settlement");
      continue;
    }

    const description = (record.Description ?? "").trim();
    const customerEmail = emailFromRevolutDescription(description);
    if (!customerEmail) {
      bumpSkip("no_email_in_description");
      continue;
    }

    const status = mapRevolutStatus(record.State ?? "");
    if (!status) {
      bumpSkip("unknown_state");
      continue;
    }
    if (status === "failed" && !options?.includeFailed) {
      bumpSkip("failed_excluded");
      continue;
    }

    const amountCents = parseAmountCents(record["Original amount"]);
    if (!amountCents) {
      bumpSkip("invalid_amount");
      continue;
    }

    const currency = (record["Original currency"] ?? "gbp").trim().toLowerCase();
    const importSkip = paymentImportSkipReason(customerEmail, amountCents, currency);
    if (importSkip) {
      bumpSkip(importSkip);
      continue;
    }

    const paidAtIso = parsePaidAtIso(
      record["Date & Time Completed (UTC)"],
      record["Date & Time Started (UTC)"]
    );
    if (!paidAtIso) {
      bumpSkip("invalid_date");
      continue;
    }

    const transactionId = (record["Transaction ID"] ?? "").trim();
    if (!transactionId) {
      bumpSkip("missing_transaction_id");
      continue;
    }

    rows.push({
      rowNumber,
      importRowKey: `revolut:${transactionId}`,
      customerEmail,
      amountCents,
      currency,
      status,
      paidAtIso,
      description,
      declineReason: status === "failed" ? (record.State ?? "").trim() || null : null,
    });
  }

  return { rows, skipped, skippedReasons };
}

export async function importRevolutMerchantPaymentsCsv(
  supabase: SupabaseClient,
  csvText: string,
  options?: RevolutCsvImportOptions
): Promise<RevolutCsvImportResult> {
  const { rows, skipped, skippedReasons } = parseRevolutMerchantPaymentsCsv(csvText, {
    includeFailed: true,
    ...options,
  });
  const directory = await loadCoachDirectory(supabase);

  const result: RevolutCsvImportResult = {
    processed: rows.length,
    imported: 0,
    skipped,
    failed: 0,
    matched: 0,
    unmatched: 0,
    skippedReasons,
    byStatus: {},
    errors: [],
  };

  for (const row of rows) {
    result.byStatus[row.status] = (result.byStatus[row.status] ?? 0) + 1;

    if (options?.dryRun) {
      const match = resolveMatch(directory, row.customerEmail);
      if (match) result.matched += 1;
      else result.unmatched += 1;
      result.imported += 1;
      continue;
    }

    try {
      const upsertResult = await upsertCoachPaymentFromCsv(supabase, directory, {
        importRowKey: row.importRowKey,
        customerEmail: row.customerEmail,
        customerCompanyName: null,
        amountCents: row.amountCents,
        currency: row.currency,
        status: row.status,
        paidAtIso: row.paidAtIso,
        declineReason: row.declineReason,
        description: row.description,
        importSource: "revolut_merchant_csv",
        paymentSource: "revolut_merchant",
      });
      result.imported += 1;
      if (upsertResult.coachId) result.matched += 1;
      else result.unmatched += 1;
    } catch (error) {
      result.failed += 1;
      if (result.errors.length < 25) {
        result.errors.push({ row: row.rowNumber, message: (error as Error).message });
      }
    }
  }

  return result;
}

function resolveMatch(directory: CoachDirectory, email: string): boolean {
  return Boolean(
    directory.uniqueCoachByEmail.get(email) ?? directory.uniqueCoachByCompany.get(email)
  );
}

export function formatRevolutCsvImportSummary(result: RevolutCsvImportResult): string {
  const skipParts = Object.entries(result.skippedReasons)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
  const statusParts = Object.entries(result.byStatus)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
  return [
    `Imported ${result.imported} Revolut merchant payment(s) (${result.skipped} skipped, ${result.failed} failed).`,
    `Matched: ${result.matched}; unmatched: ${result.unmatched}.`,
    statusParts ? `By status: ${statusParts}.` : "",
    skipParts ? `Skipped: ${skipParts}.` : "",
    "Reserve rows are Revolut internal holds (not customer payments) and were ignored.",
  ]
    .filter(Boolean)
    .join(" ");
}

export function isRevolutMerchantExportCsv(csvText: string): boolean {
  const firstLine = csvText.split(/\r?\n/)[0]?.toLowerCase() ?? "";
  return (
    firstLine.includes("transaction id") &&
    firstLine.includes("original amount") &&
    (firstLine.includes("settlement currency") || firstLine.includes("settlement amount"))
  );
}
