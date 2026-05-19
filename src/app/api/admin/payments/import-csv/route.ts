import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/requireAdmin";
import {
  formatImportPaymentsCsvSummary,
  importPaymentsCsv,
} from "@/lib/importPaymentsCsv";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const maxDuration = 300;

export async function POST(request: Request) {
  const check = await requireAdmin(request);
  if (check.error) {
    const status = check.error === "Server error." ? 500 : 401;
    return NextResponse.json({ error: check.error }, { status });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "CSV file is required." }, { status: 400 });
    }

    const paidOnly = formData.get("paidOnly") === "true";
    const includeIncomplete = formData.get("includeIncomplete") === "true";
    const csvText = await file.text();

    if (!csvText.trim()) {
      return NextResponse.json({ error: "CSV file is empty." }, { status: 400 });
    }

    const result = await importPaymentsCsv(supabaseAdmin, csvText, {
      paidOnly,
      includeIncomplete,
    });

    return NextResponse.json({
      ok: true,
      summary: formatImportPaymentsCsvSummary(result),
      ...result,
    });
  } catch (error) {
    console.error("admin/payments/import-csv POST:", error);
    const message = (error as Error).message;
    if (message.includes("coach_payments") || message.includes("relation")) {
      return NextResponse.json(
        {
          error:
            "Unable to write payments. Ensure coach_payments migrations have been applied.",
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: "CSV import failed." }, { status: 500 });
  }
}
