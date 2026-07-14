import type { CoachTableViewSettings, CoachTableViewsPayload } from "@/lib/admin/coachTableViews";

async function parseError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return body.error ?? "Request failed.";
}

export async function fetchCoachTableViews(
  accessToken: string
): Promise<CoachTableViewsPayload> {
  const res = await fetch("/api/admin/coach-table-views", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as CoachTableViewsPayload;
}

export async function createCoachTableViewRemote(
  accessToken: string,
  input: {
    name: string;
    settings: CoachTableViewSettings;
    isPrivate?: boolean;
    makeActive?: boolean;
  }
): Promise<CoachTableViewsPayload> {
  const res = await fetch("/api/admin/coach-table-views", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as CoachTableViewsPayload;
}

export async function updateCoachTableViewRemote(
  accessToken: string,
  viewId: string,
  input: {
    name?: string;
    settings?: CoachTableViewSettings;
    isPrivate?: boolean;
  }
): Promise<CoachTableViewsPayload> {
  const res = await fetch(`/api/admin/coach-table-views/${viewId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as CoachTableViewsPayload;
}

export async function deleteCoachTableViewRemote(
  accessToken: string,
  viewId: string
): Promise<CoachTableViewsPayload> {
  const res = await fetch(`/api/admin/coach-table-views/${viewId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as CoachTableViewsPayload;
}

export async function updateCoachTableViewPreferencesRemote(
  accessToken: string,
  input: {
    activeViewId?: string;
    autosave?: boolean;
    viewOrder?: string[];
  }
): Promise<CoachTableViewsPayload> {
  const res = await fetch("/api/admin/coach-table-views/preferences", {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as CoachTableViewsPayload;
}
