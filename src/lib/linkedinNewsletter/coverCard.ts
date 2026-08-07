/** Client-side LinkedIn newsletter cover (1280×720) → PNG blob. */

export type NewsletterCoverTemplate = "navy_banner" | "orange_accent" | "minimal_dark";

export type NewsletterCoverInput = {
  template: NewsletterCoverTemplate;
  newsletterName: string;
  headline: string;
  tagline: string;
  emoji?: string;
  authorName?: string;
};

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let current = words[0]!;
  for (let i = 1; i < words.length; i++) {
    const next = `${current} ${words[i]}`;
    if (ctx.measureText(next).width <= maxWidth) current = next;
    else {
      lines.push(current);
      current = words[i]!;
    }
  }
  lines.push(current);
  return lines;
}

export async function renderNewsletterCoverPng(
  input: NewsletterCoverInput
): Promise<Blob> {
  const w = 1280;
  const h = 720;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available.");

  const template = input.template;
  if (template === "orange_accent") {
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#f97316";
    ctx.fillRect(0, 0, 18, h);
    ctx.fillStyle = "#f97316";
    ctx.fillRect(0, h - 12, w, 12);
  } else if (template === "minimal_dark") {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#0b1220");
    g.addColorStop(1, "#1e293b");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  } else {
    // navy_banner
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#0a2540");
    g.addColorStop(1, "#0A66C2");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(0, 0, w * 0.38, h);
  }

  const pad = 72;
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = "600 28px system-ui, sans-serif";
  ctx.fillText(
    (input.emoji ? `${input.emoji} ` : "") + (input.newsletterName || "Newsletter"),
    pad,
    pad + 10
  );

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 64px system-ui, sans-serif";
  const headlineLines = wrapLines(ctx, input.headline || "This week's topic", w - pad * 2);
  let y = pad + 110;
  for (const line of headlineLines.slice(0, 3)) {
    ctx.fillText(line, pad, y);
    y += 74;
  }

  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "500 32px system-ui, sans-serif";
  const tagLines = wrapLines(ctx, input.tagline || "", w - pad * 2);
  y += 24;
  for (const line of tagLines.slice(0, 2)) {
    ctx.fillText(line, pad, y);
    y += 42;
  }

  if (input.authorName?.trim()) {
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.font = "500 24px system-ui, sans-serif";
    ctx.fillText(input.authorName.trim(), pad, h - 48);
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png")
  );
  if (!blob) throw new Error("Failed to render cover PNG.");
  return blob;
}

export async function renderNewsletterCoverDataUrl(
  input: NewsletterCoverInput
): Promise<string> {
  const blob = await renderNewsletterCoverPng(input);
  return URL.createObjectURL(blob);
}
