"use client";

import { useEffect, useState } from "react";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";

type CoachRow = {
  coach_id: string;
  name: string;
  reply_mode: string;
  autopilot_allowed: boolean;
  min_confidence: number;
  autopilot_last_30_days: number;
};
type Data = { globalOn: boolean; whatsapp: { status: string; name: string | null } | null; coaches: CoachRow[] };

async function adminHeaders(): Promise<Record<string, string> | null> {
  const headers = await getCoachAuthHeaders(null);
  if (!headers) return null;
  delete headers["x-impersonate-coach-id"];
  return headers;
}

export function AvaAutopilotAdmin() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const headers = await adminHeaders();
      if (!headers || cancelled) return;
      const res = await fetch("/api/admin/ava/autopilot", { headers });
      const body = (await res.json().catch(() => null)) as (Data & { error?: string }) | null;
      if (cancelled) return;
      if (!res.ok || !body?.coaches) setError(body?.error ?? "Could not load autopilot settings.");
      else setData(body);
    })();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const patch = async (payload: Record<string, unknown>) => {
    const headers = await adminHeaders();
    if (!headers) return null;
    const res = await fetch("/api/admin/ava/autopilot", { method: "PATCH", headers, body: JSON.stringify(payload) });
    const body = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
    if (!res.ok) {
      setError(body?.error ?? "Could not save.");
      return null;
    }
    setError(null);
    setReload((n) => n + 1);
    return body;
  };

  if (!data) return error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null;

  return (
    <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-base font-semibold text-slate-900">Alerts and autopilot</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div className="text-sm">
          <p className="font-medium text-slate-800">BCA WhatsApp for alerts</p>
          <p className="mt-1 text-slate-600">
            {data.whatsapp ? `Connected${data.whatsapp.name ? ` (${data.whatsapp.name})` : ""} · ${data.whatsapp.status}` : "Not connected. Coaches get phone and email alerts only."}
          </p>
          <button
            type="button"
            onClick={async () => {
              const out = await patch({ connect_whatsapp: true });
              if (out?.url) window.location.href = out.url;
            }}
            className="mt-2 rounded-md border border-slate-300 px-3 py-1.5"
          >
            {data.whatsapp ? "Reconnect WhatsApp" : "Connect BCA WhatsApp (scan QR)"}
          </button>
        </div>
        <div className="text-sm">
          <p className="font-medium text-slate-800">Autopilot for everyone</p>
          <p className="mt-1 text-slate-600">
            Master switch. When off, no coach&apos;s autopilot sends anything, whatever their own setting.
          </p>
          <label className="mt-2 flex items-center gap-2">
            <input id="ava-global" type="checkbox" checked={data.globalOn} onChange={(e) => void patch({ global: e.target.checked })} />
            {data.globalOn ? "On" : "Off"}
          </label>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="py-1 pr-3 font-medium">Coach</th>
              <th className="py-1 pr-3 font-medium">Their choice</th>
              <th className="py-1 pr-3 font-medium">Allow autopilot</th>
              <th className="py-1 pr-3 font-medium">Confidence needed</th>
              <th className="py-1 font-medium">Autopilot replies (30 days)</th>
            </tr>
          </thead>
          <tbody>
            {data.coaches.map((c) => (
              <tr key={c.coach_id} className="border-t border-slate-100">
                <td className="py-1.5 pr-3 text-slate-900">{c.name}</td>
                <td className="py-1.5 pr-3 capitalize text-slate-700">{c.reply_mode}</td>
                <td className="py-1.5 pr-3">
                  <input
                    id={`allow-${c.coach_id}`}
                    type="checkbox"
                    checked={c.autopilot_allowed}
                    onChange={(e) => void patch({ coach_id: c.coach_id, allowed: e.target.checked })}
                  />
                </td>
                <td className="py-1.5 pr-3">
                  <select
                    id={`conf-${c.coach_id}`}
                    value={String(c.min_confidence)}
                    onChange={(e) => void patch({ coach_id: c.coach_id, allowed: c.autopilot_allowed, min_confidence: Number(e.target.value) })}
                    className="rounded border border-slate-300 px-1 py-0.5"
                  >
                    {[0.75, 0.8, 0.85, 0.9, 0.95].map((v) => (
                      <option key={v} value={String(v)}>
                        {Math.round(v * 100)}%
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-1.5 tabular-nums text-slate-700">{c.autopilot_last_30_days}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
