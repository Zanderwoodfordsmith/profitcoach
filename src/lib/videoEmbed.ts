export type LessonVideoEmbed =
  | { kind: "youtube"; videoId: string; embedUrl: string }
  | { kind: "vimeo"; videoId: string; embedUrl: string };

/**
 * Best-effort YouTube / Vimeo watch URLs → embed details. Returns null if not recognized.
 */
export function parseLessonVideoEmbed(url: string): LessonVideoEmbed | null {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const videoId = u.pathname.replace(/^\//, "").split("/")[0];
      if (!videoId) return null;
      return {
        kind: "youtube",
        videoId,
        embedUrl: `https://www.youtube.com/embed/${videoId}`,
      };
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      let videoId: string | null = null;
      if (u.pathname.startsWith("/embed/")) {
        videoId = u.pathname.replace("/embed/", "").split("/")[0] || null;
      } else {
        videoId = u.searchParams.get("v");
      }
      if (!videoId) return null;
      return {
        kind: "youtube",
        videoId,
        embedUrl: `https://www.youtube.com/embed/${videoId}`,
      };
    }

    if (host === "vimeo.com" || host === "player.vimeo.com") {
      const parts = u.pathname.split("/").filter(Boolean);
      const videoId = parts[parts.length - 1];
      if (videoId && /^\d+$/.test(videoId)) {
        return {
          kind: "vimeo",
          videoId,
          embedUrl: `https://player.vimeo.com/video/${videoId}`,
        };
      }
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Best-effort YouTube / Vimeo watch URLs → embed URL. Returns null if not recognized.
 */
export function toYouTubeEmbedUrl(url: string): string | null {
  return parseLessonVideoEmbed(url)?.embedUrl ?? null;
}
