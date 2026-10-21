const POSTER_MAX_WIDTH = 960;
const POSTER_TIMEOUT_MS = 8_000;

function waitForEvent(target: HTMLVideoElement, event: string): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => done(false), POSTER_TIMEOUT_MS);
    function done(ok: boolean) {
      window.clearTimeout(timer);
      target.removeEventListener(event, onEvent);
      target.removeEventListener("error", onError);
      resolve(ok);
    }
    function onEvent() {
      done(true);
    }
    function onError() {
      done(false);
    }
    target.addEventListener(event, onEvent);
    target.addEventListener("error", onError);
  });
}

function drawPlayButton(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const r = Math.round(Math.min(w, h) * 0.13);
  const cx = w / 2;
  const cy = h / 2;
  ctx.fillStyle = "rgba(15, 23, 42, 0.72)";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  const t = r * 0.42;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(cx - t * 0.7, cy - t);
  ctx.lineTo(cx - t * 0.7, cy + t);
  ctx.lineTo(cx + t * 1.05, cy);
  ctx.closePath();
  ctx.fill();
}

/**
 * Browser only. A JPEG still from early in the video with a play button drawn
 * on top, or null if the browser can't decode it (e.g. some .mov files).
 */
export async function videoPosterFile(file: File): Promise<File | null> {
  if (typeof document === "undefined") return null;
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  try {
    const loaded = waitForEvent(video, "loadeddata");
    video.src = url;
    if (!(await loaded) || !video.videoWidth || !video.videoHeight) return null;

    // Recorded WebM often reports Infinity duration; half a second in still works.
    const target = Number.isFinite(video.duration)
      ? Math.min(1, video.duration / 4)
      : 0.5;
    if (target > 0) {
      const seeked = waitForEvent(video, "seeked");
      video.currentTime = target;
      await seeked;
    }

    const scale = Math.min(1, POSTER_MAX_WIDTH / video.videoWidth);
    const w = Math.round(video.videoWidth * scale);
    const h = Math.round(video.videoHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, w, h);
    drawPlayButton(ctx, w, h);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82)
    );
    return blob ? new File([blob], "video-poster.jpg", { type: "image/jpeg" }) : null;
  } catch {
    return null;
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
