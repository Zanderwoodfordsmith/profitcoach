"use client";

import { useCallback, useEffect, useState } from "react";
import { formatPhoneDisplay } from "@/lib/formatPhoneDisplay";

export type DuplicateContactSummary = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  business_name: string | null;
};

type Props = {
  contactId: string;
  /** Keep this contact; delete the other. */
  authHeaders: () => Promise<Record<string, string> | null>;
  onMerged: (survivorId: string, mergedId: string) => void;
  className?: string;
};

export function ProspectMergeDuplicates({
  contactId,
  authHeaders,
  onMerged,
  className,
}: Props) {
  const [dupes, setDupes] = useState<DuplicateContactSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [mergingId, setMergingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) return;
      const res = await fetch(
        `/api/coach/contacts/merge?contactId=${encodeURIComponent(contactId)}`,
        { headers }
      );
      const body = (await res.json()) as {
        duplicates?: DuplicateContactSummary[];
        error?: string;
      };
      if (!res.ok) {
        setError(body.error || "Unable to check duplicates.");
        return;
      }
      setDupes(body.duplicates ?? []);
    } catch {
      setError("Unable to check duplicates.");
    } finally {
      setLoading(false);
    }
  }, [authHeaders, contactId]);

  useEffect(() => {
    void load();
  }, [load]);

  const mergeIntoThis = async (otherId: string) => {
    setMergingId(otherId);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) return;
      const res = await fetch("/api/coach/contacts/merge", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          survivorId: contactId,
          mergedId: otherId,
        }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(body.error || "Merge failed.");
        return;
      }
      setDupes((prev) => prev.filter((d) => d.id !== otherId));
      onMerged(contactId, otherId);
    } catch {
      setError("Merge failed.");
    } finally {
      setMergingId(null);
    }
  };

  if (loading && dupes.length === 0) return null;
  if (!loading && dupes.length === 0 && !error) return null;

  return (
    <div
      className={
        className ??
        "rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2.5 text-sm text-amber-950"
      }
    >
      <p className="font-medium">Possible duplicates</p>
      <p className="mt-0.5 text-xs text-amber-800/80">
        Same phone, email, or LinkedIn as another contact. Merge to keep one
        record and combine conversations.
      </p>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      <ul className="mt-2 space-y-2">
        {dupes.map((d) => (
          <li
            key={d.id}
            className="flex items-start justify-between gap-2 rounded-md bg-white/70 px-2.5 py-2"
          >
            <div className="min-w-0">
              <div className="truncate font-medium text-slate-900">
                {d.full_name || "Unnamed"}
              </div>
              <div className="truncate text-xs text-slate-500">
                {[
                  d.business_name,
                  d.email,
                  d.phone ? formatPhoneDisplay(d.phone) : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "No contact details"}
              </div>
            </div>
            <button
              type="button"
              disabled={mergingId === d.id}
              onClick={() => void mergeIntoThis(d.id)}
              className="shrink-0 rounded-md bg-amber-800 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-900 disabled:opacity-60"
            >
              {mergingId === d.id ? "Merging…" : "Merge into this"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
