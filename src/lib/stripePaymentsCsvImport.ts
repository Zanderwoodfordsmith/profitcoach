import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import { parse } from "csv-parse/sync";

import { paymentImportSkipReason } from "@/lib/paymentImportFilters";
import { legacyStripeProductImportReason } from "@/lib/paymentProductFilters";
import {
  loadCoachDirectory,
  upsertCoachPaymentFromCsv,
  type CoachDirectory,
  type CsvPaymentStatus,
} from "@/lib/stripePaymentsSync";

export type StripeCsvImportOptions = {
  paidOnly?: boolean;
  includeIncomplete?: boolean;
  /** Apply legacy BCA product filters (6-week / Elevate; skip Strivx, Dreams, etc.). */
  legacyProductFilter?: boolean;
  dryRun?: boolean;
};

export type StripeCsvImportResult = {
  processed: number;
  imported: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  matched: number;
  unmatched: number;
  paymentSource: "stripe" | "stripe_stryv_us";
  skippedReasons: Record<string, number>;
  byStatus: Record<string, number>;
  errors: Array<{ row: number; message: string }>;
};

/** Stripe Dashboard → Charges export (pre–Payment Intents unified export). */
export function isLegacyStripeChargesExport(csvText: string): boolean {
  const header = csvText.split(/\r?\n/)[0]?.toLowerCase() ?? "";
  return (
    header.startsWith("id,") &&
    header.includes("created date (utc)") &&
    header.includes("customer email")
  );
}

const DEFAULT_IMPORT_STATUSES = new Set(["Paid", "Failed", "Refunded", "canceled"]);

const INCOMPLETE_STATUSES = new Set([
  "requires_payment_method",
  "requires_confirmation",
]);

type ParsedCsvRow = {
  rowNumber: number;
  stripeChargeId: string | null;
  importRowKey: string;
  customerEmail: string;
  customerCompanyName: string | null;
  amountCents: number;
  currency: string;
  status: CsvPaymentStatus;
  paidAtIso: string;
  declineReason: string | null;
  description: string | null;
  stripeInvoiceId: string | null;
};

function normalizeCompany(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
  return normalized.length > 0 ? normalized : null;
}

function mapStripeStatus(
  rawStatus: string,
  amountRefunded: string | undefined
): CsvPaymentStatus | null {
  const refunded = Number.parseFloat(String(amountRefunded ?? "0").replace(/,/g, ""));
  if (Number.isFinite(refunded) && refunded > 0) {
    return "refunded";
  }

  switch (rawStatus.trim()) {
    case "Paid":
      return "succeeded";
    case "Failed":
      return "failed";
    case "Refunded":
      return "refunded";
    case "canceled":
      return "canceled";
    default:
      return null;
  }
}

function parseAmountCents(amountRaw: string | undefined): number | null {
  const cleaned = String(amountRaw ?? "").replace(/,/g, "").trim();
  if (!cleaned) return null;
  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}

/** Stripe charges export uses `YYYY-MM-DD H:MM:SS` (single-digit hour). */
export function parseStripeCsvPaidAtIso(createdRaw: string | undefined): string | null {
  const trimmed = String(createdRaw ?? "").trim();
  if (!trimmed) return null;

  let isoCandidate = trimmed;
  if (!isoCandidate.includes("T")) {
    const spaced = trimmed.match(
      /^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{2}):(\d{2})$/
    );
    if (spaced) {
      const hour = spaced[2].padStart(2, "0");
      isoCandidate = `${spaced[1]}T${hour}:${spaced[3]}:${spaced[4]}Z`;
    } else {
      isoCandidate = `${trimmed.replace(" ", "T")}Z`;
    }
  }

  const parsed = Date.parse(isoCandidate);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}

function buildImportRowKey(parts: {
  email: string;
  paidAtIso: string;
  amountCents: number;
  status: string;
}): string {
  const raw = `${parts.email}|${parts.paidAtIso}|${parts.amountCents}|${parts.status}`;
  return `csv:${createHash("sha256").update(raw).digest("hex").slice(0, 32)}`;
}

export function parseStripeUnifiedPaymentsCsv(
  csvText: string,
  options?: StripeCsvImportOptions
): {
  rows: ParsedCsvRow[];
  skipped: number;
  skippedReasons: Record<string, number>;
} {
  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  }) as Record<string, string>[];

  const allowedStatuses = options?.paidOnly
    ? new Set(["Paid"])
    : options?.includeIncomplete
      ? new Set([...DEFAULT_IMPORT_STATUSES, ...INCOMPLETE_STATUSES])
      : DEFAULT_IMPORT_STATUSES;

  const useLegacyProductFilter =
    options?.legacyProductFilter ??
    isLegacyStripeChargesExport(csvText);

  const rows: ParsedCsvRow[] = [];
  let skipped = 0;
  const skippedReasons: Record<string, number> = {};

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const rowNumber = index + 2;
    const rawStatus = record.Status?.trim() ?? "";

    if (!allowedStatuses.has(rawStatus)) {
      skipped += 1;
      skippedReasons[`status:${rawStatus || "empty"}`] =
        (skippedReasons[`status:${rawStatus || "empty"}`] ?? 0) + 1;
      continue;
    }

    const mappedStatus = mapStripeStatus(rawStatus, record["Amount Refunded"]);
    if (!mappedStatus) {
      skipped += 1;
      skippedReasons.unmapped_status = (skippedReasons.unmapped_status ?? 0) + 1;
      continue;
    }

    const email = (
      record["Customer Email"]?.trim() ||
      record["customer_email (metadata)"]?.trim() ||
      ""
    ).toLowerCase();
    if (!email) {
      skipped += 1;
      skippedReasons.missing_email = (skippedReasons.missing_email ?? 0) + 1;
      continue;
    }

    const amountCents = parseAmountCents(record.Amount);
    if (!amountCents) {
      skipped += 1;
      skippedReasons.invalid_amount = (skippedReasons.invalid_amount ?? 0) + 1;
      continue;
    }

    const currency = (record.Currency?.trim() || "gbp").toLowerCase();
    const emailSkip = paymentImportSkipReason(email, amountCents, currency);
    if (emailSkip) {
      skipped += 1;
      skippedReasons[emailSkip] = (skippedReasons[emailSkip] ?? 0) + 1;
      continue;
    }

    const description = record.Description?.trim() || null;
    if (useLegacyProductFilter) {
      const productSkip = legacyStripeProductImportReason(description);
      if (productSkip) {
        skipped += 1;
        skippedReasons[productSkip] = (skippedReasons[productSkip] ?? 0) + 1;
        continue;
      }
    }

    const paidAtIso = parseStripeCsvPaidAtIso(record["Created date (UTC)"]);
    if (!paidAtIso) {
      skipped += 1;
      skippedReasons.invalid_date = (skippedReasons.invalid_date ?? 0) + 1;
      continue;
    }

    const stripeChargeId = record.id?.trim() || null;
    const importRowKey =
      stripeChargeId ??
      buildImportRowKey({
        email,
        paidAtIso,
        amountCents,
        status: mappedStatus,
      });

    const declineReason =
      record["Decline Reason"]?.trim() ||
      (mappedStatus === "failed" ? record["Seller Message"]?.trim() : "") ||
      null;

    rows.push({
      rowNumber,
      stripeChargeId,
      importRowKey: stripeChargeId ? `charge:${stripeChargeId}` : importRowKey,
      customerEmail: email,
      customerCompanyName:
        record["companyName (metadata)"]?.trim() ||
        record["Customer Description"]?.trim() ||
        null,
      amountCents,
      currency,
      status: mappedStatus,
      paidAtIso,
      declineReason,
      description,
      stripeInvoiceId: record["Invoice ID"]?.trim() || null,
    });
  }

  return { rows, skipped, skippedReasons };
}

export async function importStripePaymentsCsv(
  supabase: SupabaseClient,
  csvText: string,
  options?: StripeCsvImportOptions
): Promise<StripeCsvImportResult> {
  const {
    rows,
    skipped: parseSkipped,
    skippedReasons: parseSkippedReasons,
  } = parseStripeUnifiedPaymentsCsv(csvText, options);
  const useLegacyProductFilter =
    options?.legacyProductFilter ??
    isLegacyStripeChargesExport(csvText);
  const paymentSource = useLegacyProductFilter ? "stripe_stryv_us" : "stripe";
  const directory = await loadCoachDirectory(supabase);

  const result: StripeCsvImportResult = {
    processed: rows.length,
    imported: 0,
    created: 0,
    updated: 0,
    skipped: parseSkipped,
    failed: 0,
    matched: 0,
    unmatched: 0,
    paymentSource,
    skippedReasons: { ...parseSkippedReasons },
    byStatus: {},
    errors: [],
  };

  for (const row of rows) {
    result.byStatus[row.status] = (result.byStatus[row.status] ?? 0) + 1;

    if (options?.dryRun) {
      const match = resolveCoachMatch(directory, row.customerEmail, row.customerCompanyName);
      if (match.coachId) {
        result.matched += 1;
      } else {
        result.unmatched += 1;
      }
      result.imported += 1;
      result.created += 1;
      continue;
    }

    try {
      const upsertResult = await upsertCoachPaymentFromCsv(supabase, directory, {
        stripeChargeId: row.stripeChargeId,
        importRowKey: row.importRowKey,
        stripeInvoiceId: row.stripeInvoiceId,
        customerEmail: row.customerEmail,
        customerCompanyName: row.customerCompanyName,
        amountCents: row.amountCents,
        currency: row.currency,
        status: row.status,
        paidAtIso: row.paidAtIso,
        declineReason: row.declineReason,
        description: row.description,
        importSource: useLegacyProductFilter ? "stripe_stryv_us_csv" : "stripe_csv",
        paymentSource,
      });

      result.imported += 1;
      if (upsertResult.created) {
        result.created += 1;
      } else {
        result.updated += 1;
      }
      if (upsertResult.coachId) {
        result.matched += 1;
      } else {
        result.unmatched += 1;
      }
    } catch (error) {
      result.failed += 1;
      if (result.errors.length < 25) {
        result.errors.push({
          row: row.rowNumber,
          message: (error as Error).message,
        });
      }
    }
  }

  return result;
}

function resolveCoachMatch(
  directory: CoachDirectory,
  email: string,
  companyName: string | null
): { coachId: string | null; method: string } {
  const emailMatch = directory.uniqueCoachByEmail.get(email);
  if (emailMatch) {
    return { coachId: emailMatch.id, method: "email_auto" };
  }

  const companyKey = normalizeCompany(companyName);
  if (companyKey) {
    const companyMatch = directory.uniqueCoachByCompany.get(companyKey);
    if (companyMatch) {
      return { coachId: companyMatch.id, method: "company_auto" };
    }
  }

  return { coachId: null, method: "unassigned" };
}

export function formatStripeCsvImportSummary(result: StripeCsvImportResult): string {
  const paymentSource = result.paymentSource;
  const statusParts = Object.entries(result.byStatus)
    .map(([status, count]) => `${status}: ${count}`)
    .join(", ");
  const skipParts = Object.entries(result.skippedReasons)
    .map(([reason, count]) => `${reason}: ${count}`)
    .join(", ");
  const sourceNote =
    paymentSource === "stripe_stryv_us"
      ? "Source: Stripe (Stryv US) — legacy account."
      : null;
  const upsertNote =
    result.created > 0 || result.updated > 0
      ? `${result.created} new, ${result.updated} updated (re-import safe by Stripe charge id).`
      : null;
  return [
    `Imported ${result.imported} row(s) (${result.skipped} skipped, ${result.failed} failed).`,
    upsertNote,
    `Matched to coach: ${result.matched}; unmatched: ${result.unmatched}.`,
    sourceNote,
    statusParts ? `By status: ${statusParts}.` : "",
    skipParts ? `Skipped: ${skipParts}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}
