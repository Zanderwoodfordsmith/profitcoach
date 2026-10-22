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
  | "script"
  | "content"
  | "links"
  | "toolkit";

export const GET_CLIENTS_LAST_TAB_KEYS: readonly GetClientsLastTabKey[] = [
  "campaigns",
  "conversations",
  "calls",
  "prospects",
  "script",
  "content",
  "links",
  "toolkit",
] as const;

const LAST_TAB_KEY_SET = new Set<string>(GET_CLIENTS_LAST_TAB_KEYS);

export const GET_CLIENTS_LAST_TAB_STORAGE_PREFIX = "pc-get-clients-last-tab";

/** Keep in sync with `getClientsTabItems` hrefs. */
const TAB_HREF: Record<GetClientsLastTabKey, (prefix: HubPrefix) => string> = {
  campaigns: (prefix) => `${prefix}/campaigns`,
  conversations: (prefix) => `${prefix}/conversations`,
  calls: (prefix) => `${prefix}/calls`,
  prospects: (prefix) => `${prefix}/prospects`,
  script: (prefix) => `${prefix}/script`,
  content: (prefix) => `${prefix}/linkedin`,
  links: (prefix) => `${prefix}/share`,
  toolkit: (prefix) => `${prefix}/toolkit`,
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

/**
 * Same idea for My Blueprint (last blueprint page) and Keep Clients (last
 * tab). Stored values are paths, but only ones that map back to themselves
 * through {@link toolsHubPageForPathname} are ever returned.
 */
export type RememberedToolsHub = "blueprint" | "keep-clients";

const BLUEPRINT_BASE: Record<HubPrefix, string> = {
  "/coach": "/coach/blueprint",
  "/admin": "/admin/blueprint/coach",
};

/** Keep in sync with `coachClientsTabItems` hrefs. */
const KEEP_CLIENTS_TABS = ["clients", "boss-pro", "playbooks", "profit-levers"];

const TOOLS_HUB_STORAGE_PREFIX: Record<RememberedToolsHub, string> = {
  blueprint: "pc-blueprint-last-page",
  "keep-clients": "pc-keep-clients-last-tab",
};

export function toolsHubHomeHref(hub: RememberedToolsHub, prefix: HubPrefix): string {
  return hub === "blueprint" ? BLUEPRINT_BASE[prefix] : `${prefix}/clients`;
}

/** The page to come back to for `pathname`, or null when it is outside the hub. */
export function toolsHubPageForPathname(
  hub: RememberedToolsHub,
  pathname: string
): string | null {
  const prefix = navPrefixFromPathname(pathname);
  if (!prefix) return null;
  const path = (pathname.split("?")[0] ?? pathname).replace(/\/$/, "");
  if (hub === "blueprint") {
    const base = BLUEPRINT_BASE[prefix];
    if (path === base) return base;
    if (!path.startsWith(`${base}/`)) return null;
    const slug = path.slice(base.length + 1).split("/")[0] ?? "";
    return /^[a-z0-9-]+$/.test(slug) ? `${base}/${slug}` : null;
  }
  for (const tab of KEEP_CLIENTS_TABS) {
    const href = `${prefix}/${tab}`;
    if (path === href || path.startsWith(`${href}/`)) return href;
  }
  return null;
}

/** Writes the current page when `pathname` is inside the hub. */
export function rememberToolsHubPage(
  hub: RememberedToolsHub,
  pathname: string,
  storage: StorageLike | null = defaultStorage()
): void {
  const prefix = navPrefixFromPathname(pathname);
  const page = toolsHubPageForPathname(hub, pathname);
  if (!prefix || !page || !storage) return;
  try {
    storage.setItem(`${TOOLS_HUB_STORAGE_PREFIX[hub]}:${prefix}`, page);
  } catch {
    /* private mode / quota */
  }
}

/** Last page this session, or the hub's home. Always an allowlisted app path. */
export function readToolsHubPageHref(
  hub: RememberedToolsHub,
  prefix: HubPrefix,
  storage: StorageLike | null = defaultStorage()
): string {
  let raw: string | null = null;
  try {
    raw = storage?.getItem(`${TOOLS_HUB_STORAGE_PREFIX[hub]}:${prefix}`) ?? null;
  } catch {
    raw = null;
  }
  if (raw && raw.startsWith(`${prefix}/`) && toolsHubPageForPathname(hub, raw) === raw) {
    return raw;
  }
  return toolsHubHomeHref(hub, prefix);
}
