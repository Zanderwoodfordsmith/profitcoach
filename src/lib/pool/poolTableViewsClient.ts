import type {
  PoolTableViewSettings,
  PoolTableViewsPayload,
} from "@/lib/pool/poolTableViews";

function apiPath(suffix = ""): string {
  return `/api/coach/pool-table-views${suffix}`;
}

async function parseError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return body.error ?? "Request failed.";
}

async function requestPayload(res: Response): Promise<PoolTableViewsPayload> {
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as PoolTableViewsPayload;
}

export async function fetchPoolTableViews(
  headers: Record<string, string>
): Promise<PoolTableViewsPayload> {
  return requestPayload(await fetch(apiPath(), { headers }));
}

export async function createPoolTableViewRemote(
  headers: Record<string, string>,
  input: {
    name: string;
    settings: PoolTableViewSettings;
    makeActive?: boolean;
  }
): Promise<PoolTableViewsPayload> {
  return requestPayload(
    await fetch(apiPath(), {
      method: "POST",
      headers,
      body: JSON.stringify(input),
    })
  );
}

export async function updatePoolTableViewRemote(
  headers: Record<string, string>,
  viewId: string,
  input: { name?: string; settings?: PoolTableViewSettings }
): Promise<PoolTableViewsPayload> {
  return requestPayload(
    await fetch(apiPath(`/${viewId}`), {
      method: "PATCH",
      headers,
      body: JSON.stringify(input),
    })
  );
}

export async function deletePoolTableViewRemote(
  headers: Record<string, string>,
  viewId: string
): Promise<PoolTableViewsPayload> {
  return requestPayload(
    await fetch(apiPath(`/${viewId}`), { method: "DELETE", headers })
  );
}

export async function updatePoolTableViewPreferencesRemote(
  headers: Record<string, string>,
  input: {
    activeViewId?: string;
    autosave?: boolean;
    viewOrder?: string[];
  }
): Promise<PoolTableViewsPayload> {
  return requestPayload(
    await fetch(apiPath("/preferences"), {
      method: "PATCH",
      headers,
      body: JSON.stringify(input),
    })
  );
}
