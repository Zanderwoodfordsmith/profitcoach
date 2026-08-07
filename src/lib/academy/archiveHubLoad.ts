import fs from "node:fs";
import path from "node:path";

import type { HubCatalog } from "@/lib/academy/hubCatalog";

const ARCHIVE_HUB_PATH = path.join(
  process.cwd(),
  "content/academy/archive-hub.json",
);

/** Lessons kept for admin access but not shown on the Classroom hub. */
export function loadArchiveHub(): HubCatalog {
  const raw = fs.readFileSync(ARCHIVE_HUB_PATH, "utf8");
  const data = JSON.parse(raw) as HubCatalog;
  if (!Array.isArray(data.courses) || data.courses.length === 0) {
    throw new Error("archive-hub.json: expected non-empty courses array");
  }
  return data;
}
