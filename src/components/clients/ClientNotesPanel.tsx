"use client";

import { useCallback, useEffect, useState } from "react";
import type { ClientSessionRow } from "@/lib/clientCoaching/loadClientSessions";
import { formatShortDateTime } from "@/lib/formatShortDate";
import { getValidSupabaseAccessToken } from "@/lib/supabaseAccessToken";
import { ClientSessionsList } from "@/components/clients/ClientSessionsList";

type Props = {
  contactId: string;
  impersonateCoachId?: string | null;
};

export function ClientNotesPanel({
  contactId,
  impersonateCoachId = null,
}: Props) {
  const [active, setActive] = useState<ClientSessionRow | null>(null);
  const [notes, setNotes] = useState("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (active) {
      setNotes(active.notes ?? "");
      setTitle(active.title ?? "Coaching session");
      setMessage(null);
      setError(null);
    }
  }, [active]);

  const authHeaders = useCallback(async () => {
    const token = await getValidSupabaseAccessToken();
    if (!token) return null;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    if (impersonateCoachId) {
      headers["x-impersonate-coach-id"] = impersonateCoachId;
    }
    return headers;
  }, [impersonateCoachId]);

  async function handleSave() {
    if (!active) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("Sign in again.");

      if (active.source === "manual" && active.id) {
        const updateRes = await fetch(
          `/api/coach/contacts/${encodeURIComponent(contactId)}/sessions/${encodeURIComponent(active.id)}`,
          {
            method: "PATCH",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({ title, notes }),
          }
        );
        const body = (await updateRes.json().catch(() => ({}))) as {
          error?: string;
        };
        if (!updateRes.ok) {
          throw new Error(body.error ?? "Unable to save notes.");
        }
      } else {
        const res = await fetch(
          `/api/coach/contacts/${encodeURIComponent(contactId)}/sessions`,
          {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({
              title,
              notes,
              startsAt: active.startsAt,
              endsAt: active.endsAt,
              bookingId: active.bookingId,
              ghlAppointmentId: active.ghlAppointmentId,
            }),
          }
        );
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          throw new Error(body.error ?? "Unable to save notes.");
        }
      }

      setMessage("Notes saved.");
      setReloadKey((k) => k + 1);
      setActive((prev) =>
        prev ? { ...prev, notes, title, hasNotesRow: true } : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save notes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <div key={reloadKey}>
        <ClientSessionsList
          contactId={contactId}
          impersonateCoachId={impersonateCoachId}
          onOpenNotes={setActive}
          showLogButton
        />
      </div>
      <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Session notes</h3>
        {!active ? (
          <p className="mt-3 text-sm text-slate-500">
            Select a session to write or edit notes. You can also log a new
            session from the list.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            <p className="text-xs text-slate-500">
              {formatShortDateTime(active.startsAt)}
            </p>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
            />
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={12}
              placeholder="What did you cover? Commitments? Next steps…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm leading-relaxed outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-70"
              >
                {saving ? "Saving…" : "Save notes"}
              </button>
              <button
                type="button"
                onClick={() => setActive(null)}
                className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
            {message ? (
              <p className="text-sm text-emerald-600">{message}</p>
            ) : null}
            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          </div>
        )}
      </section>
    </div>
  );
}
