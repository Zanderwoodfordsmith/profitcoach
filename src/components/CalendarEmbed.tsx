"use client";

import { useEffect, useRef } from "react";

type CalendarEmbedProps = {
  embedCode: string;
  className?: string;
};

function isAllowedIframeAttr(name: string): boolean {
  return [
    "id",
    "src",
    "style",
    "scrolling",
    "width",
    "height",
    "title",
    "allow",
    "allowfullscreen",
    "loading",
    "referrerpolicy",
  ].includes(name);
}

export function CalendarEmbed({ embedCode, className }: CalendarEmbedProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = "";
    const trimmed = embedCode.trim();
    if (!trimmed) return;

    const parsed = new DOMParser().parseFromString(trimmed, "text/html");
    const nodes = Array.from(parsed.body.childNodes);
    let hasIframe = false;

    for (const node of nodes) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        const tagName = element.tagName.toLowerCase();

        if (tagName === "iframe") {
          const iframe = document.createElement("iframe");
          for (const attr of Array.from(element.attributes)) {
            const attrName = attr.name.toLowerCase();
            if (attrName.startsWith("on")) continue;
            if (!isAllowedIframeAttr(attrName)) continue;
            iframe.setAttribute(attr.name, attr.value);
          }
          iframe.style.maxWidth = "100%";
          iframe.style.minHeight = iframe.style.minHeight || "700px";
          hasIframe = true;
          container.appendChild(iframe);
          continue;
        }

        if (tagName === "script") {
          const src = element.getAttribute("src")?.trim();
          if (!src) continue;
          if (!/^https?:\/\//i.test(src)) continue;
          const script = document.createElement("script");
          script.src = src;
          const scriptType = element.getAttribute("type");
          if (scriptType) script.type = scriptType;
          if (element.hasAttribute("async")) script.async = true;
          if (element.hasAttribute("defer")) script.defer = true;
          container.appendChild(script);
          continue;
        }

        if (tagName === "br") {
          container.appendChild(document.createElement("br"));
          continue;
        }
      }
    }

    if (!hasIframe) {
      container.innerHTML = "";
    }
  }, [embedCode]);

  return <div ref={containerRef} className={className} />;
}
