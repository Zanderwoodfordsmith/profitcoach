import fs from "node:fs";
import path from "node:path";

import type { LegacyHubCatalog } from "@/lib/academy/legacyHubCatalog";

const LEGACY_HUB_PATH = path.join(
  process.cwd(),
  "content/academy/legacy-hub.json",
);

export function loadLegacyHub(): LegacyHubCatalog {
  const raw = fs.readFileSync(LEGACY_HUB_PATH, "utf8");
  const data = JSON.parse(raw) as LegacyHubCatalog;
  if (!Array.isArray(data.courses) || data.courses.length === 0) {
    throw new Error("legacy-hub.json: expected non-empty courses array");
  }
  return data;
}
