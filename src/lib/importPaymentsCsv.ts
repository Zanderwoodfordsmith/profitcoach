import type { SupabaseClient } from "@supabase/supabase-js";

import {
  formatStripeCsvImportSummary,
  importStripePaymentsCsv,
  type StripeCsvImportOptions,
  type StripeCsvImportResult,
} from "@/lib/stripePaymentsCsvImport";
import {
  formatRevolutDirectCsvImportSummary,
  importRevolutDirectPaymentsCsv,
  isRevolutDirectStatementCsv,
  type RevolutDirectCsvImportOptions,
  type RevolutDirectCsvImportResult,
} from "@/lib/revolutDirectPaymentsCsvImport";
import {
  formatRevolutCsvImportSummary,
  importRevolutMerchantPaymentsCsv,
  isRevolutMerchantExportCsv,
  type RevolutCsvImportOptions,
  type RevolutCsvImportResult,
} from "@/lib/revolutPaymentsCsvImport";

export type ImportPaymentsCsvOptions = StripeCsvImportOptions &
  RevolutCsvImportOptions &
  RevolutDirectCsvImportOptions;

export type ImportPaymentsCsvResult =
  | ({ format: "stripe" } & StripeCsvImportResult)
  | ({ format: "revolut_merchant" } & RevolutCsvImportResult)
  | ({ format: "revolut_direct" } & RevolutDirectCsvImportResult);

export function detectPaymentsCsvFormat(
  csvText: string
): "stripe" | "revolut_merchant" | "revolut_direct" {
  if (isRevolutDirectStatementCsv(csvText)) return "revolut_direct";
  if (isRevolutMerchantExportCsv(csvText)) return "revolut_merchant";
  return "stripe";
}

export async function importPaymentsCsv(
  supabase: SupabaseClient,
  csvText: string,
  options?: ImportPaymentsCsvOptions
): Promise<ImportPaymentsCsvResult> {
  const format = detectPaymentsCsvFormat(csvText);
  if (format === "revolut_direct") {
    const result = await importRevolutDirectPaymentsCsv(supabase, csvText, options);
    return { format: "revolut_direct", ...result };
  }
  if (format === "revolut_merchant") {
    const result = await importRevolutMerchantPaymentsCsv(supabase, csvText, options);
    return { format: "revolut_merchant", ...result };
  }
  const result = await importStripePaymentsCsv(supabase, csvText, options);
  return { format: "stripe", ...result };
}

export function formatImportPaymentsCsvSummary(result: ImportPaymentsCsvResult): string {
  if (result.format === "revolut_direct") {
    return formatRevolutDirectCsvImportSummary(result);
  }
  if (result.format === "revolut_merchant") {
    return formatRevolutCsvImportSummary(result);
  }
  return formatStripeCsvImportSummary(result);
}

export { isLegacyStripeChargesExport } from "@/lib/stripePaymentsCsvImport";
