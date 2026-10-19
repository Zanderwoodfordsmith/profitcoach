"use client";

import { useEffect, useMemo, useState } from "react";

type Arm = { key: string; label: string; body: string };
type Slot = { key: string; label: string; hint?: string; max?: number };
type Test = { id: string; name: string; hypothesis: string | null; step_type: "invite" | "message"; arms: Arm[]; slots: Slot[] };

function fill(body: string, fills: Record<string, string>): string {
  return body.replace(/\[\[\s*([a-z0-9_]+)\s*\]\]/gi, (_, k: string) => fills[k.toLowerCase()] || `[${k}]`);
}

/** Join or leave a BCA group test for this campaign. */
export function CampaignGroupTestPanel({
  campaignId,
  getHeaders,
  onChanged,
}: {
  campaignId: string;
  getHeaders: () => Promise<Record<string, string> | null>;
  onChanged: () => void;
}) {
  const [tests, setTests] = useState<Test[]>([]);
  const [current, setCurrent] = useState<{ group_test_id: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<string>("");
  const [fills, setFills] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const headers = await getHeaders();
      if (!headers || cancelled) return;
      const res = await fetch(`/api/coach/group-tests?campaignId=${encodeURIComponent(campaignId)}`, { headers });
      const body = (await res.json().catch(() => null)) as { tests?: Test[]; current?: { group_test_id: string } | null } | null;
      if (cancelled || !res.ok || !body) return;
      setTests(body.tests ?? []);
      setCurrent(body.current ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [campaignId, getHeaders, reload]);

  const test = useMemo(() => tests.find((t) => t.id === pick) ?? null, [tests, pick]);
  const currentTest = current ? tests.find((t) => t.id === current.group_test_id) : null;

  const call = async (method: "POST" | "DELETE", payload: Record<string, unknown>) => {
    const headers = await getHeaders();
    if (!headers) return;
    setBusy(true);
    const res = await fetch("/api/coach/group-tests", { method, headers, body: JSON.stringify(payload) });
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    setBusy(false);
    if (!res.ok) {
      setError(body?.error ?? "Something went wrong.");
      return;
    }
    setError(null);
    setOpen(false);
    setReload((n) => n + 1);
    onChanged();
  };

  if (current) {
    return (
      <div className="mt-4 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>
            <span className="font-semibold">In a BCA group test</span>
            {currentTest ? `: ${currentTest.name}` : ""}. Half your people get version A, half get B, and results pool with other coaches. The wording is fixed so the comparison is fair.
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() => void call("DELETE", { campaignId })}
            className="rounded-md border border-violet-300 bg-white px-2.5 py-1 text-xs disabled:opacity-50"
          >
            Leave test
          </button>
        </div>
        {error ? <p className="mt-1 text-xs text-rose-700">{error}</p> : null}
      </div>
    );
  }

  if (!tests.length) return null;

  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between text-left">
        <span>
          <span className="font-medium text-slate-900">Join a BCA group test</span>
          <span className="text-slate-500"> · help every coach learn what works, faster</span>
        </span>
        <span className="text-xs underline">{open ? "Hide" : "Show"}</span>
      </button>
      {open ? (
        <div className="mt-3 space-y-3">
          <label className="block text-xs text-slate-600">
            Test
            <select
              id="group-test-pick"
              value={pick}
              onChange={(e) => {
                setPick(e.target.value);
                setFills({});
              }}
              className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 text-sm"
            >
              <option value="">Choose a test…</option>
              {tests.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.step_type === "invite" ? "connection request" : "first message"})
                </option>
              ))}
            </select>
          </label>
          {test ? (
            <>
              {test.hypothesis ? <p className="text-slate-600">{test.hypothesis}</p> : null}
              {test.slots.map((slot) => (
                <label key={slot.key} className="block text-xs text-slate-600">
                  {slot.label}
                  <input
                    id={`slot-${slot.key}`}
                    value={fills[slot.key] ?? ""}
                    maxLength={slot.max ?? 120}
                    onChange={(e) => setFills({ ...fills, [slot.key]: e.target.value })}
                    placeholder={slot.hint}
                    className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 text-sm"
                  />
                </label>
              ))}
              <div className="grid gap-2 sm:grid-cols-2">
                {test.arms.map((arm) => (
                  <div key={arm.key} className="rounded border border-slate-200 bg-slate-50 p-2">
                    <p className="text-xs font-medium text-slate-500">
                      Version {arm.key}: {arm.label}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-slate-800">{fill(arm.body, fills)}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500">
                This replaces your {test.step_type === "invite" ? "connection request" : "first message"} while the test runs.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void call("POST", { campaignId, testId: test.id, fills })}
                className="rounded-md bg-slate-900 px-3 py-1.5 text-white disabled:opacity-50"
              >
                Join this test
              </button>
            </>
          ) : null}
          {error ? <p className="text-xs text-rose-700">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
