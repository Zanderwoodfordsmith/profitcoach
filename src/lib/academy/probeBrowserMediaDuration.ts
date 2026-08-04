/**
 * Browser-side duration probe for admin lesson media uploads.
 * Uses a temporary <audio>/<video> element — no extra dependencies.
 */

import { formatLessonDurationFromSeconds } from "@/lib/academy/hubCatalog";

export function probeBrowserMediaDurationSeconds(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const mime = file.type?.toLowerCase() ?? "";
    const isAudio =
      mime.startsWith("audio/") ||
      /\.(mp3|m4a|aac|wav|ogg)$/i.test(file.name);
    const el = document.createElement(isAudio ? "audio" : "video");
    const objectUrl = URL.createObjectURL(file);
    let settled = false;

    const finish = (seconds: number | null) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(objectUrl);
      el.removeAttribute("src");
      el.load();
      resolve(seconds);
    };

    el.preload = "metadata";
    el.onloadedmetadata = () => {
      const d = el.duration;
      finish(Number.isFinite(d) && d > 0 ? d : null);
    };
    el.onerror = () => finish(null);
    el.src = objectUrl;
  });
}

export async function probeBrowserMediaDurationLabel(
  file: File
): Promise<string | null> {
  const seconds = await probeBrowserMediaDurationSeconds(file);
  if (seconds == null) return null;
  return formatLessonDurationFromSeconds(seconds);
}
