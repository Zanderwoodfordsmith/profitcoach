import "server-only";

import fs from "node:fs";
import path from "node:path";

import type { HubCatalog } from "@/lib/academy/hubCatalog";

const VAULT_HUB_PATH = path.join(process.cwd(), "content/academy/vault-hub.json");

let vaultHubCache: HubCatalog | null = null;
let vaultHubCacheMtimeMs = 0;

/** Bonus programmes outside the Classroom path (StryvX first). */
export function loadVaultHub(): HubCatalog {
  const mtimeMs = fs.statSync(VAULT_HUB_PATH).mtimeMs;
  if (vaultHubCache && vaultHubCacheMtimeMs === mtimeMs) {
    return vaultHubCache;
  }

  const data = JSON.parse(fs.readFileSync(VAULT_HUB_PATH, "utf8")) as HubCatalog;
  if (!Array.isArray(data.courses) || data.courses.length === 0) {
    throw new Error("vault-hub.json: expected non-empty courses array");
  }

  vaultHubCache = data;
  vaultHubCacheMtimeMs = mtimeMs;
  return vaultHubCache;
}
