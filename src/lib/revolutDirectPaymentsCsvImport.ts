import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { parse } from "csv-parse/sync";

import { paymentImportSkipReason } from "@/lib/paymentImportFilters";
import {
  loadCoachDirectory,
  upsertCoachPaymentFromCsv,
  type CoachDirectory,
  type CsvPaymentStatus,
} from "@/lib/stripePaymentsSync";

export type RevolutDirectCsvImportOptions = {
  dryRun?: boolean;
};

export type RevolutDirectCsvImportResult = {
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

type ParsedRevolutDirectRow = {
  rowNumber: number;
  importRowKey: string;
  customerEmail: string;
  customerCompanyName: string;
  amountCents: number;
  currency: string;
  status: CsvPaymentStatus;
  paidAtIso: string;
  description: string;
  declineReason: string | null;
};

const EMAIL_IN_TEXT = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

const INTERNAL_PAYER_PATTERNS = [
  /^stripe payments/i,
  /^revolut\b/i,
  /^paypal\*/i,
];

function extractEmail(text: string): string | null {
  const match = text.match(EMAIL_IN_TEXT);
  return match ? match[0].toLowerCase() : null;
}

function slugifyForEmail(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** Statement amounts are major units (e.g. 495 = £495). */
function parseStatementAmountCents(amountRaw: string | undefined): number | null {
  const cleaned = String(amountRaw ?? "").replace(/,/g, "").trim();
  if (!cleaned) return null;
  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}

function parseStatementDate(
  completedRaw: string | undefined,
  startedRaw: string | undefined
): string | null {
  const raw = (completedRaw?.trim() || startedRaw?.trim() || "").trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const parsed = Date.parse(`${raw}T12:00:00.000Z`);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }

  return null;
}

function mapStatementStatus(state: string): CsvPaymentStatus | null {
  switch (state.trim().toUpperCase()) {
    case "COMPLETED":
      return "succeeded";
    case "DECLINED":
    case "FAILED":
    case "REVERTED":
      return "failed";
    default:
      return null;
  }
}

export function parseRevolutDirectPayer(description: string): string | null {
  const trimmed = description.trim();
  if (!trimmed) return null;

  const topup = /^money added from\s+(.+)$/i.exec(trimmed);
  if (topup) return topup[1].trim();

  const transfer = /^from\s+(.+)$/i.exec(trimmed);
  if (transfer) return transfer[1].trim();

  return null;
}

function looksLikeInvoiceReference(reference: string): boolean {
  const value = reference.trim();
  if (!value) return false;
  return (
    /^(inv[-\s]?|invoice\b)/i.test(value) ||
    /^\/purp\//i.test(value) ||
    /^[A-Z]{2,5}[-\s]?\d/i.test(value)
  );
}

/** Display label, e.g. "Andy Mclachlan (FORTRESS HEA)". */
export function formatRevolutTransferCustomerLabel(
  payer: string,
  reference: string
): string {
  const payerClean = payer.trim();
  const refClean = reference.trim();

  const email = extractEmail(refClean) ?? extractEmail(payerClean);
  if (email) {
    const name =
      refClean && !extractEmail(refClean)
        ? refClean
        : payerClean && !extractEmail(payerClean)
          ? payerClean
          : "";
    if (name) return `${name} (${email})`;
    return email;
  }

  if (
    refClean &&
    !looksLikeInvoiceReference(refClean) &&
    payerClean &&
    payerClean.toLowerCase() !== refClean.toLowerCase()
  ) {
    return `${refClean} (${payerClean})`;
  }

  if (refClean && looksLikeInvoiceReference(refClean) && payerClean) {
    return `${payerClean} (${refClean})`;
  }

  return refClean || payerClean || "";
}

export function buildRevolutDirectDescription(
  payer: string,
  reference: string
): string {
  return formatRevolutTransferCustomerLabel(payer, reference);
}

const REVOLUT_TRANSFER_PLACEHOLDER_EMAIL =
  /^revolut-transfer\+[^@]+@import\.revolut$/i;

export function isRevolutTransferPlaceholderEmail(email: string): boolean {
  return REVOLUT_TRANSFER_PLACEHOLDER_EMAIL.test(email.trim());
}

/** What to show in the Customer column (not the synthetic import email). */
export function revolutTransferCustomerDisplayLabel(payment: {
  customer_email: string;
  description: string | null;
  customer_company_name: string | null;
  payment_source: string;
}): string {
  if (payment.payment_source !== "revolut_direct") {
    return payment.customer_email;
  }

  if (!isRevolutTransferPlaceholderEmail(payment.customer_email)) {
    return payment.customer_email;
  }

  const description = payment.description?.trim() ?? "";
  if (description.includes(" — ")) {
    const [payer, reference] = description.split(" — ").map((part) => part.trim());
    return formatRevolutTransferCustomerLabel(payer, reference);
  }

  if (description) {
    return description;
  }

  return payment.customer_company_name?.trim() || payment.customer_email;
}

function buildCustomerIdentity(
  payer: string,
  reference: string,
  revolutId: string
): { customerEmail: string; customerCompanyName: string } {
  const combined = `${payer} ${reference}`;
  const email =
    extractEmail(reference) ??
    extractEmail(payer) ??
    extractEmail(combined);

  const customerCompanyName = payer.trim() || reference.trim();

  if (email) {
    return { customerEmail: email, customerCompanyName: customerCompanyName };
  }

  const slug =
    slugifyForEmail(payer) ||
    slugifyForEmail(reference) ||
    createHash("sha256").update(revolutId).digest("hex").slice(0, 12);

  return {
    customerEmail: `revolut-transfer+${slug}@import.revolut`,
    customerCompanyName: customerCompanyName,
  };
}

function isInternalPayer(payer: string): boolean {
  return INTERNAL_PAYER_PATTERNS.some((pattern) => pattern.test(payer.trim()));
}

export function isRevolutDirectStatementCsv(csvText: string): boolean {
  const firstLine = csvText.split(/\r?\n/)[0]?.toLowerCase() ?? "";
  return (
    firstLine.includes("date started") &&
    firstLine.includes("payment currency") &&
    firstLine.includes("reference") &&
    !firstLine.includes("settlement currency")
  );
}

export function parseRevolutDirectPaymentsCsv(
  csvText: string
): { rows: ParsedRevolutDirectRow[]; skipped: number; skippedReasons: Record<string, number> } {
  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  }) as Record<string, string>[];

  const rows: ParsedRevolutDirectRow[] = [];
  let skipped = 0;
  const skippedReasons: Record<string, number> = {};

  const bumpSkip = (reason: string) => {
    skipped += 1;
    skippedReasons[reason] = (skippedReasons[reason] ?? 0) + 1;
  };

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const rowNumber = index + 2;
    const type = (record.Type ?? "").trim().toUpperCase();

    if (type !== "TOPUP" && type !== "TRANSFER") {
      bumpSkip(type === "CARD_CREDIT" ? "card_credit" : "not_incoming_transfer");
      continue;
    }

    const payer = parseRevolutDirectPayer(record.Description ?? "");
    if (!payer) {
      bumpSkip("unrecognized_description");
      continue;
    }

    if (isInternalPayer(payer)) {
      bumpSkip("internal_payer");
      continue;
    }

    const status = mapStatementStatus(record.State ?? "");
    if (!status) {
      bumpSkip("unknown_state");
      continue;
    }

    const amountCents = parseStatementAmountCents(record.Amount);
    if (!amountCents) {
      bumpSkip("invalid_amount");
      continue;
    }

    const currency = (record["Payment currency"] ?? "gbp").trim().toLowerCase();
    const reference = (record.Reference ?? "").trim();
    const { customerEmail, customerCompanyName } = buildCustomerIdentity(
      payer,
      reference,
      record.ID ?? `${rowNumber}`
    );

    const importSkip = paymentImportSkipReason(customerEmail, amountCents, currency);
    if (importSkip) {
      bumpSkip(importSkip);
      continue;
    }

    const paidAtIso = parseStatementDate(
      record["Date completed (UTC)"],
      record["Date started (UTC)"]
    );
    if (!paidAtIso) {
      bumpSkip("invalid_date");
      continue;
    }

    const revolutId = (record.ID ?? "").trim();
    if (!revolutId) {
      bumpSkip("missing_id");
      continue;
    }

    const description = buildRevolutDirectDescription(payer, reference);

    rows.push({
      rowNumber,
      importRowKey: `revolut-direct:${revolutId}`,
      customerEmail,
      customerCompanyName,
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

export async function importRevolutDirectPaymentsCsv(
  supabase: SupabaseClient,
  csvText: string,
  options?: RevolutDirectCsvImportOptions
): Promise<RevolutDirectCsvImportResult> {
  const { rows, skipped, skippedReasons } = parseRevolutDirectPaymentsCsv(csvText);
  const directory = await loadCoachDirectory(supabase);

  const result: RevolutDirectCsvImportResult = {
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
      const match = resolveMatch(directory, row.customerEmail, row.customerCompanyName);
      if (match) result.matched += 1;
      else result.unmatched += 1;
      result.imported += 1;
      continue;
    }

    try {
      const upsertResult = await upsertCoachPaymentFromCsv(supabase, directory, {
        importRowKey: row.importRowKey,
        customerEmail: row.customerEmail,
        customerCompanyName: row.customerCompanyName,
        amountCents: row.amountCents,
        currency: row.currency,
        status: row.status,
        paidAtIso: row.paidAtIso,
        declineReason: row.declineReason,
        description: row.description,
        importSource: "revolut_direct_csv",
        paymentSource: "revolut_direct",
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

function resolveMatch(
  directory: CoachDirectory,
  email: string,
  companyName: string
): boolean {
  if (
    directory.uniqueCoachByPaymentEmail.get(email) ??
    directory.uniqueCoachByEmail.get(email)
  ) {
    return true;
  }
  const companyKey = companyName.trim().toLowerCase().replace(/\s+/g, " ");
  if (companyKey && directory.uniqueCoachByCompany.get(companyKey)) return true;
  return false;
}

export function formatRevolutDirectCsvImportSummary(
  result: RevolutDirectCsvImportResult
): string {
  const skipParts = Object.entries(result.skippedReasons)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
  const statusParts = Object.entries(result.byStatus)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
  return [
    `Imported ${result.imported} Revolut transfer payment(s) (${result.skipped} skipped, ${result.failed} failed).`,
    `Matched: ${result.matched}; unmatched: ${result.unmatched}.`,
    statusParts ? `By status: ${statusParts}.` : "",
    skipParts ? `Skipped: ${skipParts}.` : "",
    "Uses payer name + reference for description; £1 and under £20/$20 are skipped.",
  ]
    .filter(Boolean)
    .join(" ");
}
