import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

export type CertificateType = "business" | "profit";

const CERTIFICATE_WIDTH = 842;
const CERTIFICATE_HEIGHT = 595;

const LAYOUT = {
  nameX: 72,
  nameYFromTop: 300,
  nameSize: 44,
  nameMaxWidth: 680,
  nameMinSize: 24,
  dateY: 98,
  dateSize: 12,
  dateAreaCenterX: 700,
} as const;

const TEMPLATE_FILES: Record<CertificateType, string> = {
  business: "business-coach-blank.png",
  profit: "profit-coach-blank.png",
};

function fitFontSize(
  text: string,
  font: PDFFont,
  maxWidth: number,
  baseSize: number,
  minSize: number
): number {
  let size = baseSize;
  while (size > minSize && font.widthOfTextAtSize(text, size) > maxWidth) {
    size -= 2;
  }
  return size;
}

function templatePath(type: CertificateType): string {
  return path.join(
    process.cwd(),
    "public",
    "certificates",
    TEMPLATE_FILES[type]
  );
}

export async function generateCertificatePdf(options: {
  certificateType: CertificateType;
  coachName: string;
  monthYear: string;
}): Promise<Uint8Array> {
  const { certificateType, coachName, monthYear } = options;
  const trimmedName = coachName.trim();
  const trimmedDate = monthYear.trim();
  if (!trimmedName) {
    throw new Error("Coach name is required.");
  }
  if (!trimmedDate) {
    throw new Error("Month and year are required.");
  }

  const pngBytes = await fs.readFile(templatePath(certificateType));
  const pdf = await PDFDocument.create();
  const image = await pdf.embedPng(pngBytes);
  const page = pdf.addPage([CERTIFICATE_WIDTH, CERTIFICATE_HEIGHT]);
  page.drawImage(image, {
    x: 0,
    y: 0,
    width: CERTIFICATE_WIDTH,
    height: CERTIFICATE_HEIGHT,
  });

  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const nameSize = fitFontSize(
    trimmedName,
    font,
    LAYOUT.nameMaxWidth,
    LAYOUT.nameSize,
    LAYOUT.nameMinSize
  );
  page.drawText(trimmedName, {
    x: LAYOUT.nameX,
    y: CERTIFICATE_HEIGHT - LAYOUT.nameYFromTop,
    size: nameSize,
    font,
    color: rgb(0, 0, 0),
  });

  const dateWidth = font.widthOfTextAtSize(trimmedDate, LAYOUT.dateSize);
  page.drawText(trimmedDate, {
    x: LAYOUT.dateAreaCenterX - dateWidth / 2,
    y: LAYOUT.dateY,
    size: LAYOUT.dateSize,
    font,
    color: rgb(0, 0, 0),
  });

  return pdf.save();
}

export function formatCertificateMonthYear(month: number, year: number): string {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Invalid month.");
  }
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error("Invalid year.");
  }
  const date = new Date(Date.UTC(year, month - 1, 1));
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function certificateDownloadFilename(
  coachName: string,
  certificateType: CertificateType
): string {
  const slug = coachName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const typeLabel =
    certificateType === "business" ? "business-coach" : "profit-coach";
  return `${slug || "coach"}-certified-${typeLabel}.pdf`;
}
