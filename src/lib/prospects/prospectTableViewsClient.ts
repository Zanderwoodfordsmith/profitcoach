import type {
  ProspectTableViewSettings,
  ProspectTableViewsPayload,
} from "@/lib/prospects/prospectTableViews";

function apiPath(
  surface: "coach" | "admin",
  suffix = ""
): string {
  const root =
    surface === "admin"
      ? "/api/admin/prospect-table-views"
      : "/api/coach/prospect-table-views";
  return `${root}${suffix}`;
}

async function parseError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return body.error ?? "Request failed.";
}

async function requestPayload(
  res: Response
): Promise<ProspectTableViewsPayload> {
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as ProspectTableViewsPayload;
}

export async function fetchProspectTableViews(
  headers: Record<string, string>,
  surface: "coach" | "admin"
): Promise<ProspectTableViewsPayload> {
  return requestPayload(
    await fetch(apiPath(surface), { headers })
  );
}

export async function createProspectTableViewRemote(
  headers: Record<string, string>,
  surface: "coach" | "admin",
  input: {
    name: string;
    settings: ProspectTableViewSettings;
    makeActive?: boolean;
  }
): Promise<ProspectTableViewsPayload> {
  return requestPayload(
    await fetch(apiPath(surface), {
      method: "POST",
      headers,
      body: JSON.stringify(input),
    })
  );
}

export async function updateProspectTableViewRemote(
  headers: Record<string, string>,
  surface: "coach" | "admin",
  viewId: string,
  input: {
    name?: string;
    settings?: ProspectTableViewSettings;
  }
): Promise<ProspectTableViewsPayload> {
  return requestPayload(
    await fetch(apiPath(surface, `/${viewId}`), {
      method: "PATCH",
      headers,
      body: JSON.stringify(input),
    })
  );
}

export async function deleteProspectTableViewRemote(
  headers: Record<string, string>,
  surface: "coach" | "admin",
  viewId: string
): Promise<ProspectTableViewsPayload> {
  return requestPayload(
    await fetch(apiPath(surface, `/${viewId}`), {
      method: "DELETE",
      headers,
    })
  );
}

export async function updateProspectTableViewPreferencesRemote(
  headers: Record<string, string>,
  surface: "coach" | "admin",
  input: {
    activeViewId?: string;
    autosave?: boolean;
    viewOrder?: string[];
  }
): Promise<ProspectTableViewsPayload> {
  return requestPayload(
    await fetch(apiPath(surface, "/preferences"), {
      method: "PATCH",
      headers,
      body: JSON.stringify(input),
    })
  );
}
