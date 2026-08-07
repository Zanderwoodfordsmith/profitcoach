/**
 * Client-only watch list for background Sales Nav imports.
 * Lets a global toast finish the job if the user leaves Lead Finder.
 */

export type WatchedSalesNavImport = {
  id: string;
  name: string | null;
  targetCount: number;
  startedAt: string;
};

const STORAGE_KEY = "sales-nav-import-watch-v1";
const DISMISS_KEY = "sales-nav-import-toast-dismissed-v1";
export const SALES_NAV_IMPORT_WATCH_EVENT = "sales-nav-import-watch";
export const SALES_NAV_IMPORT_RESUME_EVENT = "sales-nav-import-resume";

function readRaw(): WatchedSalesNavImport[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (row): row is WatchedSalesNavImport =>
        Boolean(
          row &&
            typeof row === "object" &&
            typeof (row as WatchedSalesNavImport).id === "string" &&
            (row as WatchedSalesNavImport).id.trim()
        )
    );
  } catch {
    return [];
  }
}

function writeRaw(jobs: WatchedSalesNavImport[]) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
    window.dispatchEvent(new Event(SALES_NAV_IMPORT_WATCH_EVENT));
  } catch {
    // ignore quota / private mode
  }
}

function readDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.sessionStorage.getItem(DISMISS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed.filter((id): id is string => typeof id === "string" && Boolean(id.trim()))
    );
  } catch {
    return new Set();
  }
}

function writeDismissed(ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(DISMISS_KEY, JSON.stringify([...ids]));
    window.dispatchEvent(new Event(SALES_NAV_IMPORT_WATCH_EVENT));
  } catch {
    // ignore
  }
}

export function listWatchedSalesNavImports(): WatchedSalesNavImport[] {
  return readRaw();
}

export function watchSalesNavImport(job: {
  id: string;
  name?: string | null;
  targetCount?: number;
}): void {
  const id = job.id.trim();
  if (!id) return;
  const next = readRaw().filter((j) => j.id !== id);
  next.push({
    id,
    name: job.name?.trim() || null,
    targetCount: Math.max(0, Math.floor(job.targetCount ?? 0)),
    startedAt: new Date().toISOString(),
  });
  // Re-show progress toast if they start / resume this job.
  const dismissed = readDismissed();
  if (dismissed.delete(id)) writeDismissed(dismissed);
  writeRaw(next);
}

/** Stop watching — used when Lead Finder handled the result itself. */
export function unwatchSalesNavImport(id: string): void {
  const trimmed = id.trim();
  if (!trimmed) return;
  writeRaw(readRaw().filter((j) => j.id !== trimmed));
  const dismissed = readDismissed();
  if (dismissed.delete(trimmed)) writeDismissed(dismissed);
}

/** Hide the sticky in-progress toast; keep polling for the success toast. */
export function dismissSalesNavImportProgressToast(id: string): void {
  const trimmed = id.trim();
  if (!trimmed) return;
  const dismissed = readDismissed();
  dismissed.add(trimmed);
  writeDismissed(dismissed);
}

export function isSalesNavImportProgressToastDismissed(id: string): boolean {
  return readDismissed().has(id.trim());
}

export function clearSalesNavImportProgressToastDismiss(id: string): void {
  const dismissed = readDismissed();
  if (dismissed.delete(id.trim())) writeDismissed(dismissed);
}

/** Ask Lead Finder (same tab) to open/resume this import. */
export function requestSalesNavImportResume(jobId: string): void {
  const id = jobId.trim();
  if (!id || typeof window === "undefined") return;
  clearSalesNavImportProgressToastDismiss(id);
  window.dispatchEvent(
    new CustomEvent(SALES_NAV_IMPORT_RESUME_EVENT, { detail: { id } })
  );
}
