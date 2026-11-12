import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { INVOICE_COLLECTOR, INVOICE_SELLER, INVOICE_VAT_NOTE } from "@/config/invoiceSeller";
import type { CoachInvoice } from "@/lib/invoices/coachInvoice";

const WIDTH = 595.28;
const HEIGHT = 841.89;
const MARGIN = 52;
const RIGHT = WIDTH - MARGIN;

const NAVY = rgb(0.043, 0.212, 0.373);
const BLUE = rgb(0.043, 0.318, 0.569);
const INK = rgb(0.059, 0.09, 0.165);
const GREY = rgb(0.392, 0.455, 0.545);
const LINE = rgb(0.886, 0.91, 0.941);
const PALE = rgb(0.953, 0.965, 0.98);
const WHITE = rgb(1, 1, 1);

/** The bars and arrow from public/brand/bca-icon.svg (500 by 500, shifted by 118, 138). */
const ICON_PATHS = [
  "M94.42 219.02 L94.42 175.7 C82.05 178.36 69.29 179.9 56.18 180.25 L56.18 219.02 Z",
  "M114.72 170.24 L114.72 219.02 L152.97 219.02 L152.97 153.48 C140.76 160.3 128 165.93 114.72 170.24 Z",
  "M173.26 140.7 L173.26 219.02 L211.51 219.02 L211.51 107.51 C199.62 119.99 186.85 131.13 173.26 140.7 Z",
  "M237.05 46.15 C186.68 126.82 104.95 180.79 0 155.81 C103.87 152.01 164.12 104.11 209.95 26.89 L199.07 19.16 L247.78 0 L247.78 53.78 Z",
];

/**
 * The built-in fonts only hold Western European letters and drawing any other
 * one throws, so a name like Łukasz becomes Lukasz rather than breaking the PDF.
 */
function fitFontLetters(text: string, font: PDFFont): string {
  const allowed = new Set(font.getCharacterSet());
  return Array.from(text.replace(/\s+/g, " "))
    .map((char) => {
      if (allowed.has(char.codePointAt(0)!)) return char;
      if (char === "ł") return "l";
      if (char === "Ł") return "L";
      const plain = char.normalize("NFD").replace(/\p{M}/gu, "");
      return Array.from(plain).every((c) => allowed.has(c.codePointAt(0)!)) ? plain : "?";
    })
    .join("");
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of text.split(" ")) {
    const next = current ? `${current} ${word}` : word;
    if (current && font.widthOfTextAtSize(next, size) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

type Style = { font: PDFFont; size: number; color?: ReturnType<typeof rgb> };

export async function renderInvoicePdf(invoice: CoachInvoice): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Invoice ${invoice.number}`);
  pdf.setAuthor(INVOICE_SELLER.name);
  const page: PDFPage = pdf.addPage([WIDTH, HEIGHT]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  /** Draws at a distance from the top of the page. */
  const draw = (raw: string, x: number, top: number, style: Style, align: "left" | "right" = "left") => {
    const text = fitFontLetters(raw, style.font);
    const shift = align === "right" ? style.font.widthOfTextAtSize(text, style.size) : 0;
    page.drawText(text, {
      x: x - shift,
      y: HEIGHT - top - style.size,
      size: style.size,
      font: style.font,
      color: style.color ?? INK,
    });
  };
  /** Wrapped text; returns the distance from the top after the last line. */
  const drawBlock = (raw: string, x: number, top: number, style: Style, maxWidth: number, gap = 4) => {
    let y = top;
    for (const line of wrapText(fitFontLetters(raw, style.font), style.font, style.size, maxWidth)) {
      draw(line, x, y, style);
      y += style.size + gap;
    }
    return y;
  };
  const rule = (top: number, from = MARGIN, to = RIGHT, color = LINE, thickness = 0.75) =>
    page.drawLine({
      start: { x: from, y: HEIGHT - top },
      end: { x: to, y: HEIGHT - top },
      thickness,
      color,
    });
  const box = (x: number, top: number, width: number, height: number, color: ReturnType<typeof rgb>) =>
    page.drawRectangle({ x, y: HEIGHT - top - height, width, height, color });

  const label = { font: bold, size: 7.5, color: BLUE };
  const body = { font: regular, size: 10 };
  const small = { font: regular, size: 8.5, color: GREY };

  // Navy band with the logo.
  box(0, 0, WIDTH, 122, NAVY);
  const iconSize = 36;
  const iconTop = 43;
  box(MARGIN, iconTop, iconSize, iconSize, BLUE);
  const scale = iconSize / 500;
  for (const path of ICON_PATHS) {
    page.drawSvgPath(path, {
      x: MARGIN + 118 * scale,
      y: HEIGHT - iconTop - 138 * scale,
      scale,
      color: WHITE,
    });
  }
  draw(INVOICE_SELLER.brand, MARGIN + iconSize + 12, 47, { font: bold, size: 13, color: WHITE });
  draw(INVOICE_SELLER.name, MARGIN + iconSize + 12, 66, { font: regular, size: 8.5, color: rgb(0.75, 0.82, 0.9) });
  draw("Invoice", RIGHT, 42, { font: regular, size: 28, color: WHITE }, "right");
  draw(`No. ${invoice.number}`, RIGHT, 76, { font: regular, size: 8.5, color: rgb(0.75, 0.82, 0.9) }, "right");

  // Who, who from, and the key facts.
  const blockTop = 152;
  const fromX = MARGIN + 156;
  const detailsX = MARGIN + 338;

  draw("BILLED TO", MARGIN, blockTop, label);
  let leftY = drawBlock(invoice.billedToName, MARGIN, blockTop + 18, { font: bold, size: 10 }, 144);
  for (const line of invoice.billedToLines) leftY = drawBlock(line, MARGIN, leftY, body, 144);
  leftY += 2;
  for (const line of invoice.billedToSmall) leftY = drawBlock(line, MARGIN, leftY, small, 144);

  draw("FROM", fromX, blockTop, label);
  let midY = drawBlock(INVOICE_SELLER.name, fromX, blockTop + 18, { font: bold, size: 10 }, 172);
  for (const line of INVOICE_SELLER.addressLines) midY = drawBlock(line, fromX, midY, body, 172);
  midY = drawBlock(`Company number ${INVOICE_SELLER.companyNumber}`, fromX, midY + 2, small, 172);
  midY = drawBlock(`Payment collected by ${INVOICE_COLLECTOR}`, fromX, midY, small, 172);

  draw("DETAILS", detailsX, blockTop, label);
  const facts: [string, string, Style][] = [
    ["Invoice date", invoice.dateLabel, body],
    ["Date paid", invoice.dateLabel, body],
    ["Total", invoice.amountLabel, { font: bold, size: 10 }],
  ];
  let factY = blockTop + 18;
  for (const [name, value, style] of facts) {
    draw(name, detailsX, factY, { font: regular, size: 10, color: GREY });
    draw(value, RIGHT, factY, style, "right");
    factY += 15;
  }
  draw("PAID IN FULL", detailsX, factY + 6, { font: bold, size: 8, color: BLUE });

  const tableTitleTop = Math.max(leftY, midY, factY + 20) + 18;
  rule(tableTitleTop);

  // The payment.
  draw(invoice.itemTitle, MARGIN, tableTitleTop + 24, { font: bold, size: 14, color: NAVY });
  const headTop = tableTitleTop + 58;
  const dateX = MARGIN + 300;
  draw("DESCRIPTION", MARGIN, headTop, label);
  draw("DATE PAID", dateX, headTop, label);
  draw("AMOUNT", RIGHT, headTop, label, "right");
  rule(headTop + 15, MARGIN, RIGHT, NAVY, 1);
  const rowTop = headTop + 28;
  draw(invoice.itemTitle, MARGIN, rowTop, body);
  draw(invoice.itemDetail, MARGIN, rowTop + 15, small);
  draw(invoice.dateLabel, dateX, rowTop, body);
  draw(invoice.amountLabel, RIGHT, rowTop, body, "right");
  rule(rowTop + 36);

  // Totals.
  const totalsX = RIGHT - 225;
  const totalsTop = rowTop + 52;
  box(totalsX, totalsTop, 225, 36, PALE);
  draw("Total", totalsX + 14, totalsTop + 12, { font: bold, size: 11, color: NAVY });
  draw(invoice.amountLabel, RIGHT - 14, totalsTop + 12, { font: bold, size: 11, color: NAVY }, "right");
  draw("VAT", totalsX, totalsTop + 49, { font: regular, size: 10 });
  draw("None charged", RIGHT, totalsTop + 49, { font: regular, size: 10 }, "right");
  rule(totalsTop + 67, totalsX);
  draw("Amount paid", totalsX, totalsTop + 77, { font: regular, size: 10 });
  draw(invoice.amountLabel, RIGHT, totalsTop + 77, { font: regular, size: 10 }, "right");
  rule(totalsTop + 95, totalsX);
  draw("Balance due", totalsX, totalsTop + 105, { font: regular, size: 10, color: GREY });
  draw(invoice.amountLabel.replace(/[\d,]+(\.\d+)?/, "0.00"), RIGHT, totalsTop + 105, { font: regular, size: 10, color: GREY }, "right");

  // Thank you and the VAT reason.
  const noteTop = totalsTop + 136;
  const noteWidth = RIGHT - MARGIN - 40;
  const noteHeight = 96;
  box(MARGIN, noteTop, RIGHT - MARGIN, noteHeight, PALE);
  box(MARGIN, noteTop, 3, noteHeight, BLUE);
  draw(
    invoice.thankYouName ? `Thank you, ${invoice.thankYouName}.` : "Thank you.",
    MARGIN + 20,
    noteTop + 14,
    { font: bold, size: 10 }
  );
  const afterThanks = drawBlock(
    `This invoice confirms your payment of ${invoice.amountLabel} was received in full.`,
    MARGIN + 20,
    noteTop + 31,
    body,
    noteWidth
  );
  drawBlock(INVOICE_VAT_NOTE, MARGIN + 20, afterThanks + 2, body, noteWidth);

  // Company footer.
  const footerTop = HEIGHT - 62;
  rule(footerTop - 12, 0, WIDTH);
  draw(INVOICE_SELLER.name, MARGIN, footerTop, small);
  draw(
    `Registered in ${INVOICE_SELLER.registeredIn}, company number ${INVOICE_SELLER.companyNumber}`,
    MARGIN,
    footerTop + 12,
    small
  );
  draw(INVOICE_SELLER.address, MARGIN, footerTop + 24, small);
  draw(INVOICE_SELLER.email, RIGHT, footerTop, small, "right");
  draw(INVOICE_SELLER.website, RIGHT, footerTop + 12, small, "right");

  return pdf.save();
}
