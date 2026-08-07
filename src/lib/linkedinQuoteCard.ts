/** Client-side Hormozi-style quote card → PNG blob. */

export type QuoteCardInput = {
  name: string;
  handle: string;
  quote: string;
  photoUrl?: string | null;
};

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const paragraphs = text.split(/\n/);
  const lines: string[] = [];
  for (const para of paragraphs) {
    const words = para.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }
    let current = words[0]!;
    for (let i = 1; i < words.length; i++) {
      const next = `${current} ${words[i]}`;
      if (ctx.measureText(next).width <= maxWidth) {
        current = next;
      } else {
        lines.push(current);
        current = words[i]!;
      }
    }
    lines.push(current);
  }
  return lines;
}

async function loadImage(url: string): Promise<HTMLImageElement | null> {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("image load failed"));
      img.src = url;
    });
    return img;
  } catch {
    return null;
  }
}

export async function renderQuoteCardPng(input: QuoteCardInput): Promise<Blob> {
  const size = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available.");

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);

  // Soft outer margin feel
  const pad = 72;
  const avatarSize = 96;
  const avatarX = pad;
  const avatarY = pad;

  // Avatar circle
  const photo = input.photoUrl ? await loadImage(input.photoUrl) : null;
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (photo) {
    ctx.drawImage(photo, avatarX, avatarY, avatarSize, avatarSize);
  } else {
    ctx.fillStyle = "#0A66C2";
    ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 42px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      (input.name || "?").slice(0, 1).toUpperCase(),
      avatarX + avatarSize / 2,
      avatarY + avatarSize / 2 + 2
    );
  }
  ctx.restore();

  // Name + handle
  const textLeft = avatarX + avatarSize + 28;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 42px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText(input.name || "You", textLeft, avatarY + 48);

  // Blue check
  const nameWidth = ctx.measureText(input.name || "You").width;
  const checkX = textLeft + nameWidth + 18;
  const checkY = avatarY + 34;
  ctx.beginPath();
  ctx.arc(checkX, checkY, 14, 0, Math.PI * 2);
  ctx.fillStyle = "#0A66C2";
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(checkX - 6, checkY);
  ctx.lineTo(checkX - 1, checkY + 5);
  ctx.lineTo(checkX + 7, checkY - 5);
  ctx.stroke();

  ctx.fillStyle = "#64748b";
  ctx.font = "500 30px system-ui, -apple-system, Segoe UI, sans-serif";
  const handle = input.handle.trim() || "Profit Coach";
  ctx.fillText(handle.startsWith("@") ? handle : handle, textLeft, avatarY + 88);

  // Quote body
  const quoteTop = avatarY + avatarSize + 72;
  const maxWidth = size - pad * 2;
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 56px system-ui, -apple-system, Segoe UI, sans-serif";
  const lines = wrapLines(ctx, input.quote.trim() || "Your quote…", maxWidth);
  const lineHeight = 72;
  let y = quoteTop;
  for (const line of lines.slice(0, 10)) {
    ctx.fillText(line, pad, y);
    y += lineHeight;
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png")
  );
  if (!blob) throw new Error("Could not export quote image.");
  return blob;
}

/** Same card as PNG export, for live composer previews. */
export async function renderQuoteCardDataUrl(
  input: QuoteCardInput
): Promise<string> {
  const blob = await renderQuoteCardPng(input);
  return URL.createObjectURL(blob);
}
