import { NextResponse } from "next/server";
import {
  certificateDownloadFilename,
  formatCertificateMonthYear,
  generateCertificatePdf,
  type CertificateType,
} from "@/lib/certificates/generateCertificatePdf";
import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Body = {
  coachId?: string;
  certificateType?: CertificateType;
  month?: number;
  year?: number;
};

function isCertificateType(value: unknown): value is CertificateType {
  return value === "business" || value === "profit";
}

export async function POST(request: Request) {
  const authCheck = await requireAdmin(request);
  if (authCheck.error) {
    const status = authCheck.error === "Server error." ? 500 : 401;
    return NextResponse.json({ error: authCheck.error }, { status });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const coachId = body.coachId?.trim();
  if (!coachId) {
    return NextResponse.json({ error: "Coach is required." }, { status: 400 });
  }
  if (!isCertificateType(body.certificateType)) {
    return NextResponse.json(
      { error: "Certificate type must be business or profit." },
      { status: 400 }
    );
  }
  if (typeof body.month !== "number" || typeof body.year !== "number") {
    return NextResponse.json(
      { error: "Month and year are required." },
      { status: 400 }
    );
  }

  let monthYear: string;
  try {
    monthYear = formatCertificateMonthYear(body.month, body.year);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid date." },
      { status: 400 }
    );
  }

  const { data: coach, error: coachError } = await supabaseAdmin
    .from("coaches")
    .select("id, full_name, coach_business_name, slug")
    .eq("id", coachId)
    .maybeSingle();

  if (coachError) {
    console.error("admin/coaches/certificate coach lookup error:", coachError);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
  if (!coach) {
    return NextResponse.json({ error: "Coach not found." }, { status: 404 });
  }

  const coachName =
    coach.full_name?.trim() ||
    coach.coach_business_name?.trim() ||
    coach.slug?.trim() ||
    "Coach";

  try {
    const pdfBytes = await generateCertificatePdf({
      certificateType: body.certificateType,
      coachName,
      monthYear,
    });
    const filename = certificateDownloadFilename(coachName, body.certificateType);

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("admin/coaches/certificate generate error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not generate certificate." },
      { status: 500 }
    );
  }
}
