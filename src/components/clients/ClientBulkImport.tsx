"use client";

import { useMemo, useState } from "react";
import { PASTE_TEMPLATE_HEADERS, parsePastedClients } from "@/lib/clientRoster/paste";
import { buttonClass } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";

/** Paste every client at once from a spreadsheet. */
export function ClientBulkImport({
  authHeaders,
  onDone,
  onClose,
}: {
  authHeaders: () => Promise<Record<string, string> | null>;
  onDone: () => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ added: number; updated: number; failed: { row: number; error?: string }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const parsed = useMemo(() => (text.trim() ? parsePastedClients(text) : null), [text]);

  const submit = async () => {
    if (!parsed?.rows.length) return;
    const headers = await authHeaders();
    if (!headers) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/coach/clients/bulk", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ rows: parsed.rows }),
    });
    const body = (await res.json().catch(() => null)) as ({ error?: string } & NonNullable<typeof result>) | null;
    setBusy(false);
    if (!res.ok || !body) {
      setError(body?.error ?? "Couldn't add those clients.");
      return;
    }
    setResult(body);
    if (body.added || body.updated) onDone();
  };

  return (
    <div className={cardClass("plain", "p-4 text-sm")}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold text-slate-900">Add all your clients at once</h3>
        <button type="button" onClick={onClose} className="text-xs text-slate-500 hover:text-slate-800">
          Close
        </button>
      </div>
      <p className="mt-1 text-slate-600">
        Copy your client list from Excel or Google Sheets, header row included, and paste it below. Only Name is required.
        The more you fill in (sector, turnover, team size, how they found you, the result you got, and a 1 to 5 score for how many
        more like them you&apos;d want), the better we can find you more of your best clients.
      </p>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(PASTE_TEMPLATE_HEADERS.join("\t"));
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            setCopied(false);
          }
        }}
        className={buttonClass("second", "small", "mt-2")}
      >
        {copied ? "Copied. Paste into row 1 of a sheet" : "Copy the column headings"}
      </button>
      <textarea
        id="client-bulk-paste"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setResult(null);
        }}
        rows={8}
        placeholder={PASTE_TEMPLATE_HEADERS.join("\t")}
        className="mt-3 block w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
      />
      {parsed?.error ? <p className="mt-2 text-amber-800">{parsed.error}</p> : null}
      {parsed && !parsed.error ? (
        <p className="mt-2 text-slate-600">
          {parsed.rows.length} client{parsed.rows.length === 1 ? "" : "s"} ready.
          {parsed.unknownHeaders.length ? ` Ignoring: ${parsed.unknownHeaders.join(", ")}.` : ""}
        </p>
      ) : null}
      <button
        type="button"
        disabled={busy || !parsed?.rows.length}
        onClick={() => void submit()}
        className={buttonClass("main", "small", "mt-3")}
      >
        {busy ? "Adding…" : `Add ${parsed?.rows.length ?? 0} clients`}
      </button>
      {error ? <p className="mt-2 text-rose-700">{error}</p> : null}
      {result ? (
        <div className="mt-3 text-slate-700">
          <p>
            Added {result.added}, updated {result.updated}
            {result.failed.length ? `, ${result.failed.length} need fixing:` : "."}
          </p>
          {result.failed.length ? (
            <ul className="mt-1 list-disc pl-5 text-rose-700">
              {result.failed.slice(0, 20).map((f) => (
                <li key={f.row}>
                  Sheet row {f.row + 1}: {f.error}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
