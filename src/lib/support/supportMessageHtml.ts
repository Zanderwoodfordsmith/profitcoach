import { inlineTokens } from "@/lib/articles";
import { splitTextWithHttpUrls } from "@/lib/communityAutolink";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeHttpHref(href: string): string | null {
  try {
    const u = new URL(href);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.href;
  } catch {
    return null;
  }
}

function withBreaks(value: string): string {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

function linkHtml(label: string, href: string): string {
  return `<a href="${escapeHtml(href)}" style="color:#0369a1;text-decoration:underline;">${label}</a>`;
}

function autolinkHtml(text: string): string {
  return splitTextWithHttpUrls(text)
    .map((part) =>
      part.type === "text"
        ? withBreaks(part.text)
        : linkHtml(withBreaks(part.label), part.href)
    )
    .join("");
}

/** Email-safe HTML for support markdown: **bold**, *italic*, [label](url), and bare links. */
export function supportMarkdownToEmailInnerHtml(body: string): string {
  return inlineTokens(body)
    .map((token) => {
      if (token.type === "strong") {
        return `<strong>${withBreaks(token.text)}</strong>`;
      }
      if (token.type === "em") {
        return `<em>${withBreaks(token.text)}</em>`;
      }
      if (token.type === "link") {
        const href = safeHttpHref(token.href);
        const label = withBreaks(token.text);
        if (!href) return label;
        return linkHtml(label, href);
      }
      return autolinkHtml(token.text);
    })
    .join("");
}
