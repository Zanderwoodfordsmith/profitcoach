"use client";

import { useEffect, useState } from "react";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";

type Arm = { key: string; label: string; body: string };
type Slot = { key: string; label: string; hint?: string };
type ArmStats = { key: string; label: string; people: number; accepted: number; replied: number; interested: number; coaches: number };
type Test = {
  id: string;
  name: string;
  hypothesis: string | null;
  step_type: "invite" | "message";
  arms: Arm[];
  slots: Slot[];
  status: "draft" | "live" | "ended";
  target_per_arm: number;
  results: { arms: ArmStats[]; coaches: number; campaigns: number; verdict: string; metric: string } | null;
};

const EMPTY: Omit<Test, "id" | "status" | "results"> = {
  name: "",
  hypothesis: "",
  step_type: "message",
  arms: [
    { key: "A", label: "", body: "" },
    { key: "B", label: "", body: "" },
  ],
  slots: [],
  target_per_arm: 1500,
};

async function adminHeaders(): Promise<Record<string, string> | null> {
  const headers = await getCoachAuthHeaders(null);
  if (!headers) return null;
  delete headers["x-impersonate-coach-id"];
  return headers;
}

function rate(n: number, d: number) {
  return d ? `${((100 * n) / d).toFixed(1)}%` : "–";
}

export function GroupTestsAdmin() {
  const [tests, setTests] = useState<Test[] | null>(null);
  const [draft, setDraft] = useState<(typeof EMPTY & { id?: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const headers = await adminHeaders();
      if (!headers || cancelled) return;
      const res = await fetch("/api/admin/group-tests", { headers });
      const body = (await res.json().catch(() => null)) as { tests?: Test[]; error?: string } | null;
      if (cancelled) return;
      if (!res.ok || !body?.tests) setError(body?.error ?? "Could not load group tests.");
      else setTests(body.tests);
    })();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const send = async (method: "POST" | "PATCH", payload: unknown) => {
    const headers = await adminHeaders();
    if (!headers) return false;
    const res = await fetch("/api/admin/group-tests", { method, headers, body: JSON.stringify(payload) });
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      setError(body?.error ?? "Could not save.");
      return false;
    }
    setError(null);
    setReload((n) => n + 1);
    return true;
  };

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-slate-600">
          Coaches add a live test to their campaign and fill in their own details. The wording is locked and each person gets
          version A or B at random, so results pool across coaches. Use <code>[[slot]]</code> for things each coach fills in,
          and merge fields like <code>{"{{first_name}}"}</code>, <code>{"{{location}}"}</code> or <code>{"{{profile_hook}}"}</code>{" "}
          (a line Ava writes from their LinkedIn profile).
        </p>
        <button type="button" onClick={() => setDraft({ ...EMPTY })} className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white">
          New test
        </button>
      </div>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      {draft ? (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 text-sm">
          <label className="block text-xs text-slate-600">
            Name
            <input id="gt-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="mt-1 block w-full rounded border border-slate-300 px-2 py-1" />
          </label>
          <label className="block text-xs text-slate-600">
            What we are testing and why
            <textarea id="gt-hyp" value={draft.hypothesis ?? ""} onChange={(e) => setDraft({ ...draft, hypothesis: e.target.value })} rows={2} className="mt-1 block w-full rounded border border-slate-300 px-2 py-1" />
          </label>
          <label className="block text-xs text-slate-600">
            Step being tested
            <select
              id="gt-step"
              value={draft.step_type}
              onChange={(e) => setDraft({ ...draft, step_type: e.target.value === "invite" ? "invite" : "message" })}
              className="mt-1 block rounded border border-slate-300 px-2 py-1"
            >
              <option value="message">First message after connecting</option>
              <option value="invite">Connection request note</option>
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            {draft.arms.map((arm, i) => (
              <div key={arm.key} className="space-y-1">
                <input
                  id={`gt-arm-label-${arm.key}`}
                  value={arm.label}
                  placeholder={`Version ${arm.key} name, e.g. Tribe callout`}
                  onChange={(e) => setDraft({ ...draft, arms: draft.arms.map((a, j) => (j === i ? { ...a, label: e.target.value } : a)) })}
                  className="block w-full rounded border border-slate-300 px-2 py-1"
                />
                <textarea
                  id={`gt-arm-body-${arm.key}`}
                  value={arm.body}
                  rows={6}
                  placeholder={`Version ${arm.key} wording`}
                  onChange={(e) => setDraft({ ...draft, arms: draft.arms.map((a, j) => (j === i ? { ...a, body: e.target.value } : a)) })}
                  className="block w-full rounded border border-slate-300 px-2 py-1 font-mono text-xs"
                />
              </div>
            ))}
          </div>
          <div>
            <p className="text-xs font-medium text-slate-600">Coach fill-ins</p>
            {draft.slots.map((slot, i) => (
              <div key={i} className="mt-1 flex flex-wrap gap-2">
                <input
                  id={`gt-slot-key-${i}`}
                  value={slot.key}
                  placeholder="key, e.g. tribe"
                  onChange={(e) => setDraft({ ...draft, slots: draft.slots.map((s, j) => (j === i ? { ...s, key: e.target.value } : s)) })}
                  className="w-32 rounded border border-slate-300 px-2 py-1 font-mono text-xs"
                />
                <input
                  id={`gt-slot-label-${i}`}
                  value={slot.label}
                  placeholder="Label coaches see"
                  onChange={(e) => setDraft({ ...draft, slots: draft.slots.map((s, j) => (j === i ? { ...s, label: e.target.value } : s)) })}
                  className="min-w-[10rem] flex-1 rounded border border-slate-300 px-2 py-1"
                />
                <input
                  id={`gt-slot-hint-${i}`}
                  value={slot.hint ?? ""}
                  placeholder="Example"
                  onChange={(e) => setDraft({ ...draft, slots: draft.slots.map((s, j) => (j === i ? { ...s, hint: e.target.value } : s)) })}
                  className="min-w-[10rem] flex-1 rounded border border-slate-300 px-2 py-1"
                />
              </div>
            ))}
            <button type="button" onClick={() => setDraft({ ...draft, slots: [...draft.slots, { key: "", label: "" }] })} className="mt-2 text-xs underline">
              Add a fill-in
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={async () => {
                if (await send("POST", draft)) setDraft(null);
              }}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-white"
            >
              Save draft
            </button>
            <button type="button" onClick={() => setDraft(null)} className="rounded-md px-3 py-1.5 text-slate-600">
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {tests === null ? <p className="text-sm text-slate-500">Loading tests…</p> : null}
      {tests?.length === 0 && !draft ? <p className="text-sm text-slate-500">No group tests yet.</p> : null}
      {tests?.map((t) => (
        <article key={t.id} className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-semibold text-slate-900">
              {t.name} <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-normal capitalize text-slate-600">{t.status}</span>
            </h3>
            <div className="flex gap-2">
              {t.status === "draft" ? (
                <>
                  <button type="button" onClick={() => setDraft({ ...t, hypothesis: t.hypothesis ?? "" })} className="rounded-md border border-slate-300 px-2.5 py-1 text-xs">
                    Edit
                  </button>
                  <button type="button" onClick={() => void send("PATCH", { id: t.id, status: "live" })} className="rounded-md bg-emerald-700 px-2.5 py-1 text-xs text-white">
                    Go live
                  </button>
                </>
              ) : null}
              {t.status === "live" ? (
                <button type="button" onClick={() => void send("PATCH", { id: t.id, status: "ended" })} className="rounded-md border border-slate-300 px-2.5 py-1 text-xs">
                  End test
                </button>
              ) : null}
            </div>
          </div>
          {t.hypothesis ? <p className="mt-1 text-slate-600">{t.hypothesis}</p> : null}
          {t.results ? (
            <>
              <p className="mt-3 font-medium text-slate-800">{t.results.verdict}</p>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-sm tabular-nums">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="py-1 pr-3 font-medium">Version</th>
                      <th className="py-1 pr-3 font-medium">People</th>
                      <th className="py-1 pr-3 font-medium">Accepted</th>
                      <th className="py-1 pr-3 font-medium">Replied</th>
                      <th className="py-1 pr-3 font-medium">Interested</th>
                      <th className="py-1 font-medium">Coaches</th>
                    </tr>
                  </thead>
                  <tbody>
                    {t.results.arms.map((a) => (
                      <tr key={a.key} className="border-t border-slate-100">
                        <td className="py-1 pr-3">
                          {a.key}: {a.label}
                        </td>
                        <td className="py-1 pr-3">
                          {a.people} <span className="text-slate-400">/ {t.target_per_arm}</span>
                        </td>
                        <td className="py-1 pr-3">{rate(a.accepted, a.people)}</td>
                        <td className="py-1 pr-3">{rate(a.replied, a.people)}</td>
                        <td className="py-1 pr-3">{rate(a.interested, a.people)}</td>
                        <td className="py-1">{a.coaches}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {t.arms.map((a) => (
                <p key={a.key} className="whitespace-pre-wrap rounded bg-slate-50 p-2 text-slate-700">
                  <span className="text-xs font-medium text-slate-500">
                    {a.key}: {a.label}
                  </span>
                  {"\n"}
                  {a.body}
                </p>
              ))}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
