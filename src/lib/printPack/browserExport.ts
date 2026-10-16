/**
 * Browser-side export for the Toolkit: SVG, PNG and print-ready PDF from the
 * print-pack SVG strings. Fonts are inlined so PNGs match the previews.
 */
import { GOOGLE_FONTS_HREF } from "./brand.js";

const KEEP_SUBSETS = new Set(["latin", "latin-ext"]);
let fontCssPromise: Promise<string> | null = null;

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Google Fonts CSS with the latin font files inlined as data URIs (cached for the session). */
function inlineFontCss(): Promise<string> {
  if (!fontCssPromise) {
    fontCssPromise = (async () => {
      const css = await (await fetch(GOOGLE_FONTS_HREF)).text();
      const faces = [...css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/g)]
        .filter((m) => KEEP_SUBSETS.has(m[1]))
        .map((m) => m[2]);
      const inlined = await Promise.all(
        faces.map(async (face) => {
          const url = face.match(/url\((https:[^)]+)\)/)?.[1];
          if (!url) return face;
          const data = await blobToDataUri(await (await fetch(url)).blob());
          return face.replace(url, data);
        })
      );
      return inlined.join("\n");
    })().catch((err) => {
      fontCssPromise = null;
      throw err;
    });
  }
  return fontCssPromise;
}

/** Fetch an image (the coach photo) and return it as a data URI, or null if it can't be read. */
export async function imageUrlToDataUri(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    return await blobToDataUri(await res.blob());
  } catch {
    return null;
  }
}

/** Drop the font @import so an SVG can sit inline on a page that already loads the fonts. */
export function svgForInline(svg: string): string {
  return svg.replace(/<\?xml[^>]*>\s*/, "").replace(/<style>@import[^<]*<\/style>\s*/, "");
}

async function svgWithEmbeddedFonts(svg: string): Promise<string> {
  const css = await inlineFontCss();
  return svg.replace(/<style>@import[^<]*<\/style>/, `<style>${css}</style>`);
}

function viewBoxOf(svg: string): [number, number, number, number] {
  const vb = svg.match(/viewBox="([^"]+)"/)?.[1].split(/\s+/).map(Number);
  if (!vb || vb.length !== 4) throw new Error("SVG has no viewBox");
  return vb as [number, number, number, number];
}

/** Physical size in mm when the SVG declares one, else px at 96 dpi converted to mm. */
function pageSizeMm(svg: string): { w: number; h: number } {
  const mm = svg.match(/<svg[^>]*?width="([\d.]+)mm" height="([\d.]+)mm"/);
  if (mm) return { w: Number(mm[1]), h: Number(mm[2]) };
  const vb = viewBoxOf(svg);
  return { w: (vb[2] / 96) * 25.4, h: (vb[3] / 96) * 25.4 };
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function downloadSvg(svg: string, filename: string): void {
  saveBlob(new Blob([svg], { type: "image/svg+xml" }), filename);
}

export async function downloadPng(svg: string, widthPx: number, filename: string): Promise<void> {
  const vb = viewBoxOf(svg);
  const width = Math.round(widthPx);
  const height = Math.round((width * vb[3]) / vb[2]);
  const withFonts = (await svgWithEmbeddedFonts(svg)).replace(
    /<svg([^>]*?) width="[^"]+" height="[^"]+"/,
    `<svg$1 width="${width}" height="${height}"`
  );
  const url = URL.createObjectURL(new Blob([withFonts], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Could not draw the graphic."));
      img.src = url;
    });
    // Give embedded fonts a beat to settle inside the SVG image.
    await new Promise((r) => setTimeout(r, 120));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available.");
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Could not create the PNG.");
    saveBlob(blob, filename);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Opens the print dialog at the graphic's exact page size. "Save as PDF" gives a
 * vector PDF with the fonts embedded, sharp enough for a printer.
 */
export async function printPdf(svg: string, title: string): Promise<void> {
  const { w, h } = pageSizeMm(svg);
  const withFonts = await svgWithEmbeddedFonts(svg);
  const body = withFonts.replace(/<\?xml[^>]*>\s*/, "");
  const doc = `<!doctype html><html><head><meta charset="utf-8"><title>${title.replace(/</g, "&lt;")}</title>
<style>@page{size:${w}mm ${h}mm;margin:0}html,body{margin:0;padding:0}svg{display:block;width:${w}mm;height:${h}mm}</style>
</head><body>${body}</body></html>`;
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(iframe);
  const cleanup = () => setTimeout(() => iframe.remove(), 1000);
  await new Promise<void>((resolve) => {
    iframe.onload = () => resolve();
    iframe.srcdoc = doc;
  });
  const win = iframe.contentWindow;
  if (!win) {
    cleanup();
    throw new Error("Could not open the print view.");
  }
  await win.document.fonts?.ready;
  win.addEventListener("afterprint", cleanup, { once: true });
  win.focus();
  win.print();
}
