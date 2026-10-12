import { supabaseClient } from "@/lib/supabaseClient";

export type CoachDirectoryRow = {
  id: string;
  slug: string;
  full_name: string | null;
  coach_business_name: string | null;
};

const STORAGE_KEY = "pc-coach-directory-v1";
const LABEL_KEY = "pc-impersonate-coach-label";

const FRESH_MS = 60_000;

let memory: CoachDirectoryRow[] | null = null;
let fetchedAt = 0;
let inflight: Promise<CoachDirectoryRow[]> | null = null;

function sortRows(rows: CoachDirectoryRow[]): CoachDirectoryRow[] {
  return [...rows].sort((a, b) =>
    displayName(a).localeCompare(displayName(b), undefined, { sensitivity: "base" })
  );
}

function displayName(coach: CoachDirectoryRow): string {
  return (
    coach.full_name?.trim() ||
    coach.coach_business_name?.trim() ||
    coach.slug ||
    "Coach"
  );
}

function readStored(): CoachDirectoryRow[] | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? "null");
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const rows = parsed.filter(
      (row): row is CoachDirectoryRow =>
        Boolean(row) &&
        typeof row.id === "string" &&
        typeof row.slug === "string"
    );
    return rows.length > 0 ? rows : null;
  } catch {
    return null;
  }
}

function writeStored(rows: CoachDirectoryRow[]) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  } catch {
    /* ignore quota */
  }
}

async function fetchDirectory(): Promise<CoachDirectoryRow[]> {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Not signed in.");
  }
  const res = await fetch("/api/admin/coaches?view=directory", {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  const body = (await res.json().catch(() => ({}))) as {
    coaches?: CoachDirectoryRow[];
    error?: string;
  };
  if (!res.ok) {
    throw new Error(body.error ?? "Could not load coaches.");
  }
  const rows = sortRows(body.coaches ?? []);
  memory = rows;
  fetchedAt = Date.now();
  writeStored(rows);
  return rows;
}

/** Names already in memory or this tab, so the menu can paint before the network returns. */
export function peekCoachDirectory(): CoachDirectoryRow[] | null {
  if (memory) return memory;
  const stored = readStored();
  if (stored) memory = stored;
  return memory;
}

/**
 * Short coach list for the Use as menu. Reuses a result from the last minute,
 * otherwise shares one in-flight request.
 */
function directoryLabel(id: string): string | null {
  const row = peekCoachDirectory()?.find((coach) => coach.id === id);
  if (!row) return null;
  return row.full_name?.trim() || row.coach_business_name?.trim() || null;
}

/** Name shown in the sidebar for the account that was just opened. */
export function rememberCoachAccountLabel(id: string, name: string) {
  const trimmed = name.trim();
  if (!id || !trimmed || trimmed === "Coach") return;
  try {
    window.sessionStorage.setItem(
      LABEL_KEY,
      JSON.stringify({ id, name: trimmed })
    );
  } catch {
    /* ignore quota */
  }
}

/** Name for this coach id, from the last choice or the cached directory. */
export function coachAccountLabel(id: string): string | null {
  if (typeof window !== "undefined") {
    try {
      const parsed = JSON.parse(
        window.sessionStorage.getItem(LABEL_KEY) ?? "null"
      ) as { id?: string; name?: string } | null;
      const remembered = parsed?.id === id ? parsed.name?.trim() : "";
      if (remembered && remembered !== "Coach") return remembered;
    } catch {
      /* ignore */
    }
  }
  return directoryLabel(id);
}

export function loadCoachDirectory(): Promise<CoachDirectoryRow[]> {
  if (memory && Date.now() - fetchedAt < FRESH_MS) {
    return Promise.resolve(memory);
  }
  if (!inflight) {
    inflight = fetchDirectory().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}
