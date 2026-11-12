import { NextResponse } from "next/server";
import { INVOICE_DETAIL_LIMITS } from "@/lib/invoices/coachInvoice";
import { loadInvoiceDetails } from "@/lib/invoices/invoiceDetails";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireCoachRequest(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  try {
    const { coachName, businessName, details } = await loadInvoiceDetails(auth.userId);
    return NextResponse.json({
      coach_name: coachName ?? "",
      business_name: businessName ?? "",
      address: details?.address ?? "",
      company_number: details?.company_number ?? "",
      vat_number: details?.vat_number ?? "",
    });
  } catch (err) {
    console.error("invoice details GET:", err);
    return NextResponse.json({ error: "Could not load your invoice details." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const auth = await requireCoachRequest(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const row: Record<string, string | null> = {};
  for (const [field, limit] of Object.entries(INVOICE_DETAIL_LIMITS)) {
    const value = typeof body[field] === "string" ? (body[field] as string).trim() : "";
    if (value.length > limit) {
      return NextResponse.json({ error: "That is too long for an invoice." }, { status: 400 });
    }
    row[field] = value || null;
  }

  const { error } = await supabaseAdmin.from("coach_invoice_details").upsert(
    { coach_id: auth.userId, ...row, updated_at: new Date().toISOString() },
    { onConflict: "coach_id" }
  );
  if (error) {
    console.error("invoice details PUT:", error.message);
    return NextResponse.json({ error: "Could not save your invoice details." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
