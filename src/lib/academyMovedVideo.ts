import { isDirectVideoFileUrl } from "@/lib/academy/videoUrl";
import { parseLessonVideoEmbed } from "@/lib/videoEmbed";

export type AcademyMovedMedia =
  | { kind: "embed"; embedUrl: string }
  | { kind: "file"; src: string };

const ID = /^[A-Za-z0-9_-]{3,64}$/;

function httpsUrl(raw: string): URL | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "https:") return null;
    return u;
  } catch {
    return null;
  }
}

function hostOf(u: URL): string {
  return u.hostname.replace(/^www\./, "").toLowerCase();
}

/** Allowlisted embed or file URL for the public /academy walkthrough. */
export function resolveAcademyMovedMedia(
  raw: string | null | undefined
): AcademyMovedMedia | null {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return null;

  const lesson = parseLessonVideoEmbed(trimmed);
  if (lesson) {
    const sep = lesson.embedUrl.includes("?") ? "&" : "?";
    return { kind: "embed", embedUrl: `${lesson.embedUrl}${sep}rel=0` };
  }

  const u = httpsUrl(trimmed);
  if (!u) return null;
  const host = hostOf(u);

  if (host === "loom.com" || host === "www.loom.com") {
    const parts = u.pathname.split("/").filter(Boolean);
    const shareIdx = parts.findIndex((p) => p === "share" || p === "embed");
    const id = shareIdx >= 0 ? parts[shareIdx + 1] : null;
    if (id && ID.test(id)) {
      return { kind: "embed", embedUrl: `https://www.loom.com/embed/${id}` };
    }
    return null;
  }

  if (
    host === "fast.wistia.net" ||
    host.endsWith(".wistia.com") ||
    host === "wistia.com"
  ) {
    const parts = u.pathname.split("/").filter(Boolean);
    let id: string | null = null;
    if (parts[0] === "embed" && parts[1] === "iframe") id = parts[2] ?? null;
    else if (parts[0] === "medias") id = parts[1] ?? null;
    if (id && ID.test(id)) {
      return {
        kind: "embed",
        embedUrl: `https://fast.wistia.net/embed/iframe/${id}`,
      };
    }
    return null;
  }

  if (isDirectVideoFileUrl(u.href)) {
    return { kind: "file", src: u.href };
  }

  return null;
}
