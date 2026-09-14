"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, Mail, Phone, Plus, X } from "lucide-react";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import {
  watchEventLabel,
  watchEventsFor,
  type CoachWatchRule,
  type WatchScopeKind,
} from "@/lib/coachWatch/rules";

type Props = {
  scopeKind: WatchScopeKind;
  scopeId: string;
};

export function CoachWatchRulesPanel({ scopeKind, scopeId }: Props) {
  const [rules, setRules] = useState<CoachWatchRule[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const events = watchEventsFor(scopeKind);
  const unused = events.filter((event) => !rules.some((r) => r.event === event.id));

  const load = useCallback(async () => {
    const headers = await getCoachAuthHeaders();
    if (!headers || !scopeId) return;
    const params = new URLSearchParams({
      scope_kind: scopeKind,
      scope_id: scopeId,
    });
    const res = await fetch(`/api/coach/watch-rules?${params}`, { headers });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "Could not load alerts.");
    setRules(body.rules ?? []);
  }, [scopeId, scopeKind]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        await load();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load alerts.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function addRule() {
    const nextEvent = unused[0];
    if (!nextEvent) return;
    setBusy(true);
    setError(null);
    try {
      const headers = await getCoachAuthHeaders();
      if (!headers) throw new Error("Sign in required.");
      const res = await fetch("/api/coach/watch-rules", {
        method: "POST",
        headers,
        body: JSON.stringify({
          scope_kind: scopeKind,
          scope_id: scopeId,
          event: nextEvent.id,
          in_app: true,
          email: false,
          whatsapp: false,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not add.");
      setRules((current) => [...current, body.rule as CoachWatchRule]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add.");
    } finally {
      setBusy(false);
    }
  }

  async function patchRule(id: string, patch: Partial<CoachWatchRule>) {
    setRules((current) =>
      current.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule))
    );
    try {
      const headers = await getCoachAuthHeaders();
      if (!headers) throw new Error("Sign in required.");
      const res = await fetch(`/api/coach/watch-rules/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(patch),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not save.");
      if (body.rule) {
        setRules((current) =>
          current.map((rule) => (rule.id === id ? body.rule : rule))
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
      await load();
    }
  }

  async function removeRule(id: string) {
    const previous = rules;
    setRules((current) => current.filter((rule) => rule.id !== id));
    try {
      const headers = await getCoachAuthHeaders();
      if (!headers) throw new Error("Sign in required.");
      const res = await fetch(`/api/coach/watch-rules/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Could not remove.");
      }
    } catch (err) {
      setRules(previous);
      setError(err instanceof Error ? err.message : "Could not remove.");
    }
  }

  return (
    <div>
      <p className="text-sm font-semibold text-slate-900">Notify me when</p>
      <p className="mt-0.5 text-xs leading-snug text-slate-500">
        Get a bell, email, or WhatsApp alert when something happens.
      </p>

      {error ? (
        <p className="mt-2 text-xs text-rose-700">{error}</p>
      ) : null}

      <ul className="mt-3 space-y-2">
        {rules.map((rule) => (
          <li
            key={rule.id}
            className="rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-2"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-medium text-slate-800">
                {watchEventLabel(scopeKind, rule.event)}
              </p>
              <button
                type="button"
                aria-label="Remove"
                onClick={() => void removeRule(rule.id)}
                className="rounded p-0.5 text-slate-400 hover:text-rose-600"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              <ChannelToggle
                label="Bell"
                icon={Bell}
                on={rule.in_app}
                onChange={(on) => void patchRule(rule.id, { in_app: on })}
              />
              <ChannelToggle
                label="Email"
                icon={Mail}
                on={rule.email}
                onChange={(on) => void patchRule(rule.id, { email: on })}
              />
              <ChannelToggle
                label="WhatsApp"
                icon={Phone}
                on={rule.whatsapp}
                onChange={(on) => void patchRule(rule.id, { whatsapp: on })}
              />
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        disabled={busy || unused.length === 0}
        onClick={() => void addRule()}
        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-1.5 py-2 text-xs font-medium text-[#0c5290] hover:bg-slate-50 disabled:opacity-40"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
        {unused.length === 0 ? "All alerts added" : "Add alert"}
      </button>
    </div>
  );
}

function ChannelToggle({
  label,
  icon: Icon,
  on,
  onChange,
}: {
  label: string;
  icon: typeof Bell;
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onChange(!on)}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
        on
          ? "bg-sky-50 text-[#0c5290]"
          : "bg-slate-100 text-slate-500 hover:text-slate-700"
      }`}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {label}
    </button>
  );
}
