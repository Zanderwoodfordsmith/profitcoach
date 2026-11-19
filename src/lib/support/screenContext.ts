"use client";

import { useEffect, useState } from "react";

import { chatPageFor } from "./chatPages";

/**
 * What's on screen, for a chat about it (18 Nov, job 228): the item a page
 * names (a prospect, a conversation, a campaign), else the deepest open tab
 * ("Lead Magnets" under Campaigns), else the page's own name.
 *
 * Pages name an item with a marker: `data-chat-about="Jason Dodd"`, and
 * `data-chat-path` when the address bar doesn't point at it (the inbox), and
 * `data-chat-conversation` for the thread open, so Ava can draft about it.
 * Tabs mark the open one with `data-tab-active` (PageHeaderUnderlineTabs).
 */
export type ScreenContext = { path: string; name: string | null; conversationId?: string | null };

function outsidePanel(el: Element): boolean {
  return !el.closest(".support-dock");
}

export function readScreenContext(): ScreenContext {
  const path = `${window.location.pathname}${window.location.search}`;
  const marked = [...document.querySelectorAll<HTMLElement>("[data-chat-about]")].filter(outsidePanel).pop();
  const named = marked?.dataset.chatAbout?.trim();
  if (marked && named) {
    return { path: marked.dataset.chatPath?.trim() || path, name: named, conversationId: marked.dataset.chatConversation?.trim() || null };
  }
  const tab = [...document.querySelectorAll<HTMLElement>("[data-tab-active]")].filter(outsidePanel).pop();
  const tabName = tab?.textContent?.replace(/\s+/g, " ").trim();
  if (tabName) return { path, name: tabName };
  const known = chatPageFor(path) ?? chatPageFor(window.location.pathname);
  return { path, name: known && !path.includes("conversation=") ? known.name : null };
}

/** Follows what's on screen as the coach moves around (pages, tabs, the item they open). */
export function useScreenContext(active: boolean): ScreenContext {
  const [screen, setScreen] = useState<ScreenContext>(() =>
    typeof window === "undefined" ? { path: "", name: null } : readScreenContext()
  );
  useEffect(() => {
    if (!active) return;
    let timer: number | undefined;
    const update = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const next = readScreenContext();
        setScreen((prev) => (prev.path === next.path && prev.name === next.name ? prev : next));
      }, 150);
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-chat-about", "data-chat-path", "data-tab-active"],
    });
    window.addEventListener("popstate", update);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener("popstate", update);
    };
  }, [active]);
  return screen;
}
