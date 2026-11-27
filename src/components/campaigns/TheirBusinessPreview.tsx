"use client";

import { useEffect, useState } from "react";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";

type Person = { id: string; company: string; line: string; location: string | null };

const FIELD_RE = /\{\{\s*their_business\s*\}\}/i;
const CELL = "truncate px-3 py-1.5";

/** Under a message that uses "Business type and location": what Ava wrote for real people in the campaign. */
export function TheirBusinessPreview({ campaignId, body }: { campaignId: string; body: string }) {
  const show = Boolean(campaignId) && FIELD_RE.test(body);
  const [people, setPeople] = useState<Person[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function load(offset: number) {
    setLoading(true);
    try {
      const headers = await getCoachAuthHeaders();
      if (!headers) return;
      const res = await fetch(
        `/api/coach/linkedin-outreach/campaigns/${encodeURIComponent(campaignId)}/their-business?offset=${offset}`,
        { headers }
      );
      const data = (await res.json().catch(() => null)) as { people?: Person[]; next?: number | null } | null;
      if (res.ok && data?.people) {
        setPeople((prev) => (offset === 0 ? data.people! : [...prev, ...data.people!]));
        setNext(data.next ?? null);
      }
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }

  useEffect(() => {
    if (!show || loaded) return;
    void load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, campaignId]);

  if (!show) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white text-sm">
      <p className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-caption font-semibold text-slate-500">
        How it reads for people in this campaign
      </p>
      {!loaded && loading ? (
        <p className="px-3 py-2 text-slate-500">Ava is writing these…</p>
      ) : people.length === 0 ? (
        <p className="px-3 py-2 text-slate-500">
          Add people to see it for real. Ava writes it for each person, like &ldquo;an Italian restaurant in Leeds&rdquo;.
        </p>
      ) : (
        <table className="w-full table-fixed">
          <thead>
            <tr className="text-left text-caption text-slate-400">
              <th className={`${CELL} w-[32%] font-medium`}>Company</th>
              <th className={`${CELL} font-medium`}>In the note</th>
              <th className={`${CELL} hidden w-[30%] font-medium sm:table-cell`}>LinkedIn location</th>
            </tr>
          </thead>
          <tbody>
            {people.map((person) => (
              <tr key={person.id} className="border-t border-slate-100">
                <td className={`${CELL} text-slate-500`} title={person.company}>
                  {person.company || "–"}
                </td>
                <td className={`${CELL} font-medium text-slate-900`} title={person.line}>
                  {person.line}
                </td>
                <td className={`${CELL} hidden text-slate-400 sm:table-cell`} title={person.location ?? ""}>
                  {person.location || "–"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {next != null ? (
        <button
          type="button"
          disabled={loading}
          onClick={() => void load(next)}
          className="w-full border-t border-slate-100 px-3 py-1.5 text-left text-caption font-medium text-sky-700 hover:bg-slate-50 hover:text-sky-900 disabled:text-slate-400"
        >
          {loading ? "Writing…" : "Show 10 more"}
        </button>
      ) : null}
    </div>
  );
}
