/**
 * Best-effort YouTube watch/share URLs → embed URL. Returns null if not recognized.
 */
export function toYouTubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = u.pathname.replace(/^\//, "").split("/")[0];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      if (u.pathname.startsWith("/embed/")) {
        return `https://www.youtube.com/embed/${u.pathname.replace("/embed/", "").split("/")[0]}`;
      }
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
    }

    if (host === "vimeo.com" || host === "player.vimeo.com") {
      const parts = u.pathname.split("/").filter(Boolean);
      const id = parts[parts.length - 1];
      if (id && /^\d+$/.test(id)) {
        return `https://player.vimeo.com/video/${id}`;
      }
    }
  } catch {
    return null;
  }
  return null;
}
