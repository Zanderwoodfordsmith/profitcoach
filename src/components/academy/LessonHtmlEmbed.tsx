"use client";

import { useEffect, useId, useRef, useState } from "react";

const IFRAME_EMBED_HEIGHT_PX = 700;

/**
 * Renders an admin-authored HTML snippet inside a sandboxed iframe so its
 * scripts and styles run in isolation from the app. The iframe has an opaque
 * origin (no `allow-same-origin`), so the embed cannot touch app cookies,
 * storage, or the parent DOM. The snippet reports its height back to the
 * parent so the frame can grow to fit its content.
 *
 * Single-iframe embeds (e.g. chat-dash client simulators) render the iframe
 * directly in the page so microphone permissions and sizing work correctly.
 */
export function LessonHtmlEmbed({ html }: { html: string }) {
  const iframeOnly = parseSingleIframeEmbed(html);
  if (iframeOnly) {
    return <DirectIframeEmbed src={iframeOnly.src} allow={iframeOnly.allow} />;
  }

  return <SandboxedHtmlEmbed html={html} />;
}

function DirectIframeEmbed({ src, allow }: { src: string; allow?: string }) {
  return (
    <iframe
      src={src}
      title="Interactive lesson embed"
      allow={allow ?? "microphone"}
      loading="lazy"
      className="my-6 block w-full rounded-xl border border-slate-200 bg-white"
      style={{ width: "100%", height: IFRAME_EMBED_HEIGHT_PX, border: 0 }}
    />
  );
}

function SandboxedHtmlEmbed({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(180);
  const frameId = useId();

  const srcDoc = buildSrcDoc(html, frameId);
  const allowMicrophone = /\ballow\s*=\s*["'][^"']*microphone/i.test(html);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const frame = iframeRef.current;
      if (!frame || event.source !== frame.contentWindow) return;
      const data = event.data as { __lessonEmbed?: string; height?: number } | null;
      if (data?.__lessonEmbed !== frameId) return;
      if (typeof data.height === "number" && data.height > 0) {
        setHeight(Math.ceil(data.height));
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [frameId]);

  if (!html.trim()) return null;

  return (
    <iframe
      ref={iframeRef}
      title="Interactive lesson embed"
      srcDoc={srcDoc}
      sandbox="allow-scripts allow-forms allow-popups allow-modals allow-popups-to-escape-sandbox"
      allow={allowMicrophone ? "microphone" : undefined}
      loading="lazy"
      className="my-6 block w-full rounded-xl border border-slate-200 bg-white"
      style={{ height: Math.max(height, IFRAME_EMBED_HEIGHT_PX) }}
    />
  );
}

function parseSingleIframeEmbed(html: string): { src: string; allow?: string } | null {
  const trimmed = html.trim();
  if (!/^<iframe\b/i.test(trimmed) || !/<\/iframe>\s*$/i.test(trimmed)) return null;

  const src = trimmed.match(/\bsrc\s*=\s*"([^"]+)"/i)?.[1]?.trim();
  if (!src) return null;

  const allow = trimmed.match(/\ballow\s*=\s*"([^"]+)"/i)?.[1]?.trim();
  return { src, allow };
}

function buildSrcDoc(html: string, frameId: string): string {
  const resizeScript = `
    (function () {
      var id = ${JSON.stringify(frameId)};
      function report() {
        var doc = document.documentElement;
        var body = document.body;
        var h = Math.max(
          doc ? doc.scrollHeight : 0,
          body ? body.scrollHeight : 0,
          body ? body.offsetHeight : 0
        );
        parent.postMessage({ __lessonEmbed: id, height: h }, "*");
      }
      window.addEventListener("load", report);
      window.addEventListener("resize", report);
      if (typeof ResizeObserver !== "undefined") {
        try { new ResizeObserver(report).observe(document.documentElement); } catch (e) {}
      }
      [50, 250, 600, 1200].forEach(function (t) { setTimeout(report, t); });
    })();
  `;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  :root { color-scheme: light; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #334155;
    line-height: 1.5;
    padding: 4px;
    box-sizing: border-box;
    overflow-x: hidden;
  }
  *, *::before, *::after { box-sizing: border-box; }
  img, video, canvas, iframe { max-width: 100%; }
</style>
</head>
<body>
${html}
<script>${resizeScript}</script>
</body>
</html>`;
}
