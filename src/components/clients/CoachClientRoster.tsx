"use client";

import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { Loader2, Plus, Search } from "lucide-react";
import { LinkedInSolidIcon } from "@/components/icons/LinkedInSolidIcon";
import {
  parseClientRosterCreate,
  parseClientRosterPatch,
} from "@/lib/clientRoster/fields";
import {
  compareRosterClients,
  formatClientTenure,
  formatGbp,
  formatJoinDate,
  rosterSummaryLine,
} from "@/lib/clientRoster/format";
import { clientWorkspacePath } from "@/lib/clientCoaching/defaults";
import { bossProHubPath } from "@/lib/isBossWorkshopPath";

export type CoachClientRosterItem = {
  id: string;
  fullName: string;
  businessName: string | null;
  jobTitle: string | null;
  headline: string | null;
  photoUrl: string | null;
  linkedinUrl: string | null;
  joinedOn: string | null;
  feeAmount: number | null;
  problemNotes: string | null;
  bossScore: number | null;
};

type Props = {
  clients: CoachClientRosterItem[];
  loading?: boolean;
  error?: string | null;
  authHeaders: () => Promise<Record<string, string> | null>;
  onChanged: () => void;
};

const INPUT =
  "block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-sky-400 focus:ring-1 focus:ring-sky-400";

const LABEL = "block text-sm font-medium text-slate-800";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function feeToInput(amount: number | null): string {
  if (amount == null) return "";
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}

function formatScore(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(0);
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

async function readError(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return body.error ?? fallback;
}

function Field({
  label,
  htmlFor,
  children,
  hint,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className={LABEL}>
        {label}
      </label>
      {children}
      {hint ? <p className="text-sm text-slate-600">{hint}</p> : null}
    </div>
  );
}

function Avatar({ client }: { client: CoachClientRosterItem }) {
  if (client.photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={client.photoUrl}
        alt=""
        className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
      />
    );
  }
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
      {initials(client.fullName)}
    </div>
  );
}

function AddClientComposer({
  prominent,
  authHeaders,
  onClose,
  onReady,
}: {
  prominent: boolean;
  authHeaders: Props["authHeaders"];
  onClose?: () => void;
  onReady: (contactId: string, notice?: string) => void;
}) {
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [joinedOn, setJoinedOn] = useState("");
  const [fee, setFee] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState<"import" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function extras(): Record<string, unknown> {
    const patch: Record<string, unknown> = {};
    if (fullName.trim()) patch.fullName = fullName.trim();
    if (businessName.trim()) patch.businessName = businessName.trim();
    if (joinedOn) patch.joinedOn = joinedOn;
    if (fee.trim()) patch.feeAmount = fee.trim();
    if (notes.trim()) patch.problemNotes = notes.trim();
    return patch;
  }

  async function handleImport() {
    setError(null);
    setBusy("import");
    let importedId: string | null = null;
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("You must be signed in.");
      const res = await fetch("/api/coach/clients/import-linkedin", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ linkedinUrl }),
      });
      if (!res.ok) {
        throw new Error(await readError(res, "Unable to import from LinkedIn."));
      }
      const body = (await res.json()) as { contactId?: string };
      if (!body.contactId) throw new Error("Unable to import from LinkedIn.");
      importedId = body.contactId;
      const contactId = importedId;

      const extra = extras();
      if (Object.keys(extra).length > 0) {
        const parsed = parseClientRosterPatch(extra);
        const patchRes = await fetch(`/api/coach/clients/${contactId}`, {
          method: "PATCH",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(parsed),
        });
        if (!patchRes.ok) {
          const notice = await readError(
            patchRes,
            "Imported the profile. Add the date and price on the row."
          );
          onReady(contactId, notice);
          return;
        }
      }

      setLinkedinUrl("");
      setFullName("");
      setBusinessName("");
      setJoinedOn("");
      setFee("");
      setNotes("");
      onReady(contactId);
    } catch (err) {
      const message = errorMessage(err, "Unable to import from LinkedIn.");
      if (importedId) onReady(importedId, message);
      else setError(message);
    } finally {
      setBusy(null);
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy("save");
    try {
      const parsed = parseClientRosterCreate({
        fullName,
        businessName,
        joinedOn: joinedOn || null,
        feeAmount: fee,
        problemNotes: notes,
        ...(linkedinUrl.trim() ? { linkedinUrl } : {}),
      });
      const headers = await authHeaders();
      if (!headers) throw new Error("You must be signed in.");
      const res = await fetch("/api/coach/clients", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      if (!res.ok) throw new Error(await readError(res, "Unable to save client."));
      const body = (await res.json()) as { contactId?: string };
      if (!body.contactId) throw new Error("Unable to save client.");
      setLinkedinUrl("");
      setFullName("");
      setBusinessName("");
      setJoinedOn("");
      setFee("");
      setNotes("");
      onReady(body.contactId);
    } catch (err) {
      setError(errorMessage(err, "Unable to save client."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <form
      onSubmit={handleSave}
      className={`rounded-2xl border border-slate-200 bg-white ${
        prominent ? "p-6 sm:p-8" : "p-5"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">
            Add a client
          </h2>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-600">
            Paste a LinkedIn profile and import their name and business. Then
            add when they joined, what you charge, and a note on the problem.
          </p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg px-2 py-1 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            Close
          </button>
        ) : null}
      </div>

      <div className="mt-5 flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 space-y-1.5">
          <label htmlFor="new-client-linkedin" className={LABEL}>
            LinkedIn profile
          </label>
          <div className="relative">
            <LinkedInSolidIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <input
              id="new-client-linkedin"
              type="url"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (!busy) void handleImport();
                }
              }}
              placeholder="https://www.linkedin.com/in/…"
              autoComplete="off"
              className={`${INPUT} py-2.5 pl-9`}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => void handleImport()}
          disabled={busy != null}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-60"
        >
          {busy === "import" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : null}
          {busy === "import" ? "Importing…" : "Import"}
        </button>
      </div>

      <p className="mt-5 text-sm font-medium text-slate-800">Or add them yourself</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Person" htmlFor="new-client-name">
          <input
            id="new-client-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
            className={INPUT}
          />
        </Field>
        <Field label="Business" htmlFor="new-client-business">
          <input
            id="new-client-business"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            autoComplete="organization"
            className={INPUT}
          />
        </Field>
        <Field label="Joined" htmlFor="new-client-joined">
          <input
            id="new-client-joined"
            type="date"
            value={joinedOn}
            onChange={(e) => setJoinedOn(e.target.value)}
            className={INPUT}
          />
        </Field>
        <Field label="Price / month" htmlFor="new-client-fee" hint="Pounds, what you charge them.">
          <input
            id="new-client-fee"
            inputMode="decimal"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            placeholder="2000"
            className={INPUT}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Problem notes" htmlFor="new-client-notes">
            <textarea
              id="new-client-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="What's going on, or the problem you are working on."
              className={INPUT}
            />
          </Field>
        </div>
      </div>

      {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}

      <div className="mt-4">
        <button
          type="submit"
          disabled={busy != null}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-60"
        >
          {busy === "save" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : null}
          {busy === "save" ? "Saving…" : "Save client"}
        </button>
      </div>
    </form>
  );
}

function ClientEditor({
  client,
  authHeaders,
  onSaved,
  autoFocusDate,
}: {
  client: CoachClientRosterItem;
  authHeaders: Props["authHeaders"];
  onSaved: () => void;
  autoFocusDate: boolean;
}) {
  const [fullName, setFullName] = useState(client.fullName);
  const [businessName, setBusinessName] = useState(client.businessName ?? "");
  const [joinedOn, setJoinedOn] = useState(client.joinedOn ?? "");
  const [fee, setFee] = useState(feeToInput(client.feeAmount));
  const [notes, setNotes] = useState(client.problemNotes ?? "");
  const [linkedinUrl, setLinkedinUrl] = useState(client.linkedinUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setFullName(client.fullName);
    setBusinessName(client.businessName ?? "");
    setJoinedOn(client.joinedOn ?? "");
    setFee(feeToInput(client.feeAmount));
    setNotes(client.problemNotes ?? "");
    setLinkedinUrl(client.linkedinUrl ?? "");
  }, [client]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const parsed = parseClientRosterPatch({
        fullName,
        businessName,
        joinedOn: joinedOn || null,
        feeAmount: fee,
        problemNotes: notes,
        linkedinUrl,
      });
      const headers = await authHeaders();
      if (!headers) throw new Error("You must be signed in.");
      const res = await fetch(`/api/coach/clients/${client.id}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      if (!res.ok) throw new Error(await readError(res, "Unable to save client."));
      setSaved(true);
      onSaved();
    } catch (err) {
      setError(errorMessage(err, "Unable to save client."));
    } finally {
      setBusy(false);
    }
  }

  const bossHref = bossProHubPath(client.id);
  const workspaceHref = clientWorkspacePath(client.id, "overview");

  return (
    <form onSubmit={handleSave} className="max-w-3xl">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Person" htmlFor={`name-${client.id}`}>
          <input
            id={`name-${client.id}`}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={INPUT}
          />
        </Field>
        <Field label="Business" htmlFor={`business-${client.id}`}>
          <input
            id={`business-${client.id}`}
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className={INPUT}
          />
        </Field>
        <Field label="Joined" htmlFor={`joined-${client.id}`}>
          <input
            id={`joined-${client.id}`}
            type="date"
            value={joinedOn}
            autoFocus={autoFocusDate}
            onChange={(e) => setJoinedOn(e.target.value)}
            className={INPUT}
          />
        </Field>
        <Field label="Price / month" htmlFor={`fee-${client.id}`}>
          <input
            id={`fee-${client.id}`}
            inputMode="decimal"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            placeholder="2000"
            className={INPUT}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Problem notes" htmlFor={`notes-${client.id}`}>
            <textarea
              id={`notes-${client.id}`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className={INPUT}
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field
            label="LinkedIn profile"
            htmlFor={`linkedin-${client.id}`}
            hint="Saved as a link. Import from Add client to pull a fresh name and photo."
          >
            <input
              id={`linkedin-${client.id}`}
              type="url"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://www.linkedin.com/in/…"
              className={INPUT}
            />
          </Field>
        </div>
      </div>

      {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {busy ? "Saving…" : "Save"}
        </button>
        {saved ? <span className="text-sm text-slate-600">Saved</span> : null}
        <Link
          href={bossHref}
          className="text-sm font-semibold text-sky-800 hover:text-sky-950"
        >
          {client.bossScore != null ? "Open BOSS Score" : "Run BOSS Score"}
        </Link>
        <Link
          href={workspaceHref}
          className="text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          Coaching workspace
        </Link>
      </div>
      <p className="mt-3 text-sm text-slate-600">
        BOSS Score is this same client. Price and join date stay on this list.
      </p>
    </form>
  );
}

export function CoachClientRoster({
  clients,
  loading = false,
  error = null,
  authHeaders,
  onChanged,
}: Props) {
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [focusToken, setFocusToken] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const appliedFocus = useRef<string | null>(null);

  useEffect(() => {
    if (!focusId) return;
    if (!clients.some((client) => client.id === focusId)) return;
    const token = `${focusId}:${focusToken}`;
    if (appliedFocus.current === token) return;
    appliedFocus.current = token;
    setExpandedId(focusId);
    setAdding(false);
    requestAnimationFrame(() => {
      document.getElementById(`client-row-${focusId}`)?.scrollIntoView({
        block: "nearest",
      });
    });
  }, [clients, focusId, focusToken]);

  const summary = rosterSummaryLine(
    clients.map((client) => ({
      feeAmount: client.feeAmount,
      joinedOn: client.joinedOn,
    }))
  );

  const query = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    const sorted = [...clients].sort(compareRosterClients);
    if (!query) return sorted;
    return sorted.filter((client) =>
      [
        client.fullName,
        client.businessName,
        client.problemNotes,
        client.headline,
        client.jobTitle,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [clients, query]);

  function markReady(contactId: string, nextNotice?: string) {
    appliedFocus.current = null;
    setNotice(nextNotice ?? null);
    setFocusId(contactId);
    setFocusToken((token) => token + 1);
    onChanged();
  }

  if (loading && clients.length === 0) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading clients">
        <div className="h-5 w-80 animate-pulse rounded bg-slate-100" />
        <div className="h-56 animate-pulse rounded-2xl border border-slate-100 bg-slate-50" />
      </div>
    );
  }

  if (error && clients.length === 0) {
    return <p className="text-sm text-rose-700">{error}</p>;
  }

  const composerOpen = adding || clients.length === 0;
  const showSearch = clients.length >= 6;

  return (
    <div className="flex flex-col gap-4 selection:bg-sky-200 selection:text-sky-950">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm font-medium text-slate-800">{summary}</p>
        <div className="flex flex-wrap items-center gap-2">
          {showSearch ? (
            <label className="relative block">
              <span className="sr-only">Search clients</span>
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500"
                aria-hidden
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search"
                className="w-40 rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
              />
            </label>
          ) : null}
          {query ? (
            <p className="text-sm text-slate-600">
              {filtered.length} matching
            </p>
          ) : null}
          {!composerOpen ? (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-600"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Add client
            </button>
          ) : null}
        </div>
      </div>

      {notice ? <p className="text-sm text-rose-700">{notice}</p> : null}

      {composerOpen ? (
        <AddClientComposer
          prominent={clients.length === 0}
          authHeaders={authHeaders}
          onClose={clients.length > 0 ? () => setAdding(false) : undefined}
          onReady={markReady}
        />
      ) : null}

      {clients.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-[0_12px_32px_-24px_rgba(15,23,42,0.35)]">
          <table className="w-full min-w-[960px] border-collapse text-left">
            <caption className="sr-only">Your clients</caption>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th scope="col" className="px-4 py-3 font-semibold">
                  Person
                </th>
                <th scope="col" className="px-3 py-3 font-semibold">
                  Business
                </th>
                <th scope="col" className="px-3 py-3 font-semibold">
                  Joined
                </th>
                <th scope="col" className="px-3 py-3 font-semibold">
                  With you
                </th>
                <th scope="col" className="px-3 py-3 text-right font-semibold">
                  Price / month
                </th>
                <th scope="col" className="px-3 py-3 text-right font-semibold">
                  BOSS
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-600">
                    No clients match that search.
                  </td>
                </tr>
              ) : (
                filtered.map((client) => {
                  const open = expandedId === client.id;
                  const tenure = formatClientTenure(client.joinedOn);
                  const secondary =
                    client.headline && client.headline !== client.businessName
                      ? client.headline
                      : client.jobTitle && client.jobTitle !== client.businessName
                        ? client.jobTitle
                        : null;
                  return (
                    <Fragment key={client.id}>
                      <tr
                        id={`client-row-${client.id}`}
                        tabIndex={0}
                        aria-expanded={open}
                        aria-label={`${open ? "Close" : "Edit"} ${client.fullName}`}
                        onClick={() =>
                          setExpandedId((current) =>
                            current === client.id ? null : client.id
                          )
                        }
                        onKeyDown={(e) => {
                          if (e.target !== e.currentTarget) return;
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setExpandedId((current) =>
                              current === client.id ? null : client.id
                            );
                          }
                        }}
                        className={`cursor-pointer border-t border-slate-100 outline-none transition-colors hover:bg-sky-50/80 focus-visible:bg-sky-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-600 ${
                          open ? "bg-sky-50/70" : ""
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar client={client} />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-900">
                                {client.fullName}
                              </p>
                              {secondary ? (
                                <p className="truncate text-xs text-slate-600">
                                  {secondary}
                                </p>
                              ) : null}
                            </div>
                            {client.linkedinUrl ? (
                              <a
                                href={client.linkedinUrl}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={`LinkedIn profile for ${client.fullName}`}
                                title="LinkedIn"
                                onClick={(e) => e.stopPropagation()}
                                className="ml-auto shrink-0 rounded-md p-1 hover:bg-sky-100"
                              >
                                <LinkedInSolidIcon className="h-4 w-4" />
                              </a>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-sm text-slate-800">
                          <span className="line-clamp-2">
                            {client.businessName || (
                              <span className="text-slate-500">Add business</span>
                            )}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm tabular-nums text-slate-800">
                          {client.joinedOn ? (
                            formatJoinDate(client.joinedOn)
                          ) : (
                            <span className="text-slate-500">Add date</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm text-slate-800">
                          {tenure ?? <span className="text-slate-500">Add date</span>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right text-sm tabular-nums text-slate-900">
                          {client.feeAmount != null ? (
                            <span className="font-medium">
                              {formatGbp(client.feeAmount)}
                            </span>
                          ) : (
                            <span className="font-normal text-slate-500">Add price</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right text-sm">
                          <Link
                            href={bossProHubPath(client.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="font-semibold tabular-nums text-sky-800 hover:text-sky-950"
                            aria-label={
                              client.bossScore != null
                                ? `BOSS Score for ${client.fullName}, ${formatScore(client.bossScore)} out of 100`
                                : `Run BOSS Score for ${client.fullName}`
                            }
                          >
                            {client.bossScore != null
                              ? formatScore(client.bossScore)
                              : "Run"}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          <p className="line-clamp-2">
                            {client.problemNotes || (
                              <span className="text-slate-500">Add notes</span>
                            )}
                          </p>
                        </td>
                      </tr>
                      {open ? (
                        <tr className="border-t border-slate-100 bg-slate-50">
                          <td colSpan={7} className="px-4 py-5 sm:px-5">
                            <ClientEditor
                              client={client}
                              authHeaders={authHeaders}
                              onSaved={onChanged}
                              autoFocusDate={
                                focusId === client.id && !client.joinedOn
                              }
                            />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
