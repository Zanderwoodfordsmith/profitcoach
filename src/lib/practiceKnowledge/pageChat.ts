import { blueprintPage, sectionByKey } from "./blueprint";

/**
 * One chat per Blueprint page (Zander and Pam, 3 Nov): the coach, BCA and Ava
 * talk about the page as a whole, instead of a thread on each section. It is
 * stored with the section comments under the key "page:chat". Older comments
 * on the page's sections show in the same chat.
 */

const SUFFIX = ":chat";

export function pageChatKey(slug: string): string {
  return `${slug}${SUFFIX}`;
}

/** The page a chat key belongs to, or null when the key is not a page chat. */
export function chatKeyPage(key: string): string | null {
  if (!key.endsWith(SUFFIX)) return null;
  const slug = key.slice(0, -SUFFIX.length);
  return blueprintPage(slug) ? slug : null;
}

/** A key comments can be written under: a section, or a page's chat. */
export function isCommentKey(key: string): boolean {
  return Boolean(sectionByKey(key) || chatKeyPage(key));
}

/** The page a comment sits on, from its section or its page chat. */
export function commentPage(key: string): string | null {
  return sectionByKey(key)?.page.slug ?? chatKeyPage(key);
}
