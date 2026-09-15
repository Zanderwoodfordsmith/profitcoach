/**
 * Session-only “last Get Clients tab” for the sidebar hub link.
 * Stores an allowlisted tab key — never a freeform path.
 */

export type HubPrefix = "/coach" | "/admin";

export type GetClientsLastTabKey =
  | "campaigns"
  | "conversations"
  | "calls"
  | "prospects"
  | "content"
  | "links";

export const GET_CLIENTS_LAST_TAB_KEYS: readonly GetClientsLastTabKey[] = [
  "campaigns",
  "conversations",
  "calls",
  "prospects",
  "content",
  "links",
] as const;

const LAST_TAB_KEY_SET = new Set<string>(GET_CLIENTS_LAST_TAB_KEYS);

export const GET_CLIENTS_LAST_TAB_STORAGE_PREFIX = "pc-get-clients-last-tab";

/** Keep in sync with `getClientsTabItems` hrefs. */
const TAB_HREF: Record<GetClientsLastTabKey, (prefix: HubPrefix) => string> = {
  campaigns: (prefix) => `${prefix}/campaigns`,
  conversations: (prefix) => `${prefix}/conversations`,
  calls: (prefix) => `${prefix}/calls`,
  prospects: (prefix) => `${prefix}/prospects`,
  content: (prefix) => `${prefix}/linkedin`,
  links: (prefix) => `${prefix}/share`,
};

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export function navPrefixFromPathname(pathname: string): HubPrefix | null {
  if (pathname.startsWith("/admin")) return "/admin";
  if (pathname.startsWith("/coach")) return "/coach";
  return null;
}

export function getClientsHubHomeHref(prefix: HubPrefix): string {
  return TAB_HREF.conversations(prefix);
}

export function hrefForGetClientsLastTab(
  prefix: HubPrefix,
  key: GetClientsLastTabKey
): string {
  return TAB_HREF[key](prefix);
}

export function getClientsLastTabKeyForPathname(
  pathname: string
): GetClientsLastTabKey | null {
  const prefix = navPrefixFromPathname(pathname);
  if (!prefix) return null;
  const path = (pathname.split("?")[0] ?? pathname).replace(/\/$/, "") || pathname;
  const ranked = GET_CLIENTS_LAST_TAB_KEYS.map((key) => ({
    key,
    href: TAB_HREF[key](prefix),
  })).sort((a, b) => b.href.length - a.href.length);

  for (const { key, href } of ranked) {
    if (path === href || path.startsWith(`${href}/`)) return key;
  }
  return null;
}

function storageKey(prefix: HubPrefix): string {
  return `${GET_CLIENTS_LAST_TAB_STORAGE_PREFIX}:${prefix}`;
}

function defaultStorage(): StorageLike | null {
  try {
    if (typeof sessionStorage === "undefined") return null;
    return sessionStorage;
  } catch {
    return null;
  }
}

function parseStoredKey(raw: string | null): GetClientsLastTabKey | null {
  if (!raw) return null;
  return LAST_TAB_KEY_SET.has(raw) ? (raw as GetClientsLastTabKey) : null;
}

/** Writes the current tab when `pathname` is a Get Clients tab (including nested). */
export function rememberGetClientsLastTab(
  pathname: string,
  storage: StorageLike | null = defaultStorage()
): GetClientsLastTabKey | null {
  const prefix = navPrefixFromPathname(pathname);
  const key = getClientsLastTabKeyForPathname(pathname);
  if (!prefix || !key) return key;
  if (!storage) return key;
  try {
    storage.setItem(storageKey(prefix), key);
  } catch {
    /* private mode / quota */
  }
  return key;
}

/** Last tab this session, or Conversations. Always an allowlisted app path. */
export function readGetClientsLastTabHref(
  prefix: HubPrefix,
  storage: StorageLike | null = defaultStorage()
): string {
  let raw: string | null = null;
  try {
    raw = storage?.getItem(storageKey(prefix)) ?? null;
  } catch {
    raw = null;
  }
  const key = parseStoredKey(raw);
  if (!key) return getClientsHubHomeHref(prefix);
  return hrefForGetClientsLastTab(prefix, key);
}
