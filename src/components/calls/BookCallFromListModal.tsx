"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { ProspectTableAvatar } from "@/components/prospects/ProspectTableAvatar";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { formatProspectPersonName } from "@/lib/prospectDisplayFormat";
import type { ProspectRow } from "@/lib/prospectRow";

type Props = {
  open: boolean;
  onClose: () => void;
  onPick: (prospect: ProspectRow) => void;
};

export function BookCallFromListModal({ open, onClose, onPick }: Props) {
  const { impersonatingCoachId } = useImpersonation();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prospects, setProspects] = useState<ProspectRow[]>([]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setError(null);
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const headers = await getCoachAuthHeaders(impersonatingCoachId);
      if (!headers) {
        if (!cancelled) {
          setError("You must be signed in to book a call.");
          setLoading(false);
        }
        return;
      }
      const res = await fetch("/api/coach/prospects", { headers });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        prospects?: ProspectRow[];
      };
      if (cancelled) return;
      if (!res.ok) {
        setError(body.error ?? "Could not load prospects.");
        setLoading(false);
        return;
      }
      setProspects(body.prospects ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [impersonatingCoachId, open]);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return prospects.slice(0, 40);
    return prospects
      .filter((row) => {
        const hay = [row.full_name, row.business_name, row.email, row.job_title]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(term);
      })
      .slice(0, 40);
  }, [prospects, query]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a call"
      titleId="book-call-from-list-title"
      subtitle="Choose who you are meeting"
      maxWidthClassName="max-w-lg"
      overlayClassName="z-[80]"
    >
      <div className="px-5 py-4">
        <label className="relative block">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            strokeWidth={1.75}
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search prospects…"
            autoFocus
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
          />
        </label>
        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
        <ul className="mt-3 max-h-[22rem] overflow-y-auto rounded-lg border border-slate-200">
          {loading ? (
            <li className="flex items-center gap-2 px-3 py-10 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading prospects…
            </li>
          ) : visible.length === 0 ? (
            <li className="px-3 py-10 text-center text-sm text-slate-600">
              {prospects.length === 0
                ? "No prospects to book yet."
                : "No one matches that search."}
            </li>
          ) : (
            visible.map((row) => {
              const name =
                formatProspectPersonName(row.full_name) || row.full_name;
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => onPick(row)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50"
                  >
                    <ProspectTableAvatar name={name} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900">
                        {name}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {row.business_name || row.email || "—"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </Modal>
  );
}
