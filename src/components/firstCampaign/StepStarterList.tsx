"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Mail, Phone, Upload, Users } from "lucide-react";
import {
  AiNote,
  Card,
  Chip,
  ErrorNote,
  FieldLabel,
  PrimaryButton,
} from "@/components/firstCampaign/firstCampaignUi";

const LINKEDIN_DOWNLOAD_DATA_URL =
  "https://www.linkedin.com/mypreferences/d/download-my-data";
import {
  CampaignSetupProgress,
  useCampaignProgressRunner,
} from "@/components/firstCampaign/CampaignSetupProgress";
import {
  LEADROCKS_REVENUE_RANGES,
  LEADROCKS_TEAM_SIZES,
} from "@/lib/leadFinder/leadrocksOptions";
import type { LeadTeaser } from "@/lib/leadFinder/types";
import {
  matchConnectionTitles,
  parseConnectionsCsv,
} from "@/lib/firstCampaign/parseConnectionsCsv";
import type { ParsedLinkedInConnection } from "@/lib/firstCampaign/types";
import { mapConnectionRows } from "@/lib/firstCampaign/mapApi";
import {
  apiPost,
  apiUploadFile,
  getAuthHeaders,
  type ChosenIcp,
  type LeadListSummary,
} from "@/lib/firstCampaign/wizardApi";

type SearchResponse = {
  leads?: LeadTeaser[];
  totalMatched?: number;
  error?: string;
};
type SaveListResponse = {
  id?: string;
  count?: number;
  itemCount?: number;
  leadList?: LeadListSummary;
  error?: string;
};
type MatchResponse = {
  matched?: Array<Record<string, unknown>>;
  matches?: Array<Record<string, unknown>>;
  matchedCount?: number;
  totalCount?: number;
  total?: number;
  batchId?: string;
  error?: string;
};

function TagInput({
  values,
  onChange,
}: {
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  return (
    <div>
      {values.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {values.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-700"
            >
              {v}
              <button
                type="button"
                onClick={() => onChange(values.filter((x) => x !== v))}
                className="text-slate-400 hover:text-slate-700"
                aria-label={`Remove ${v}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            const t = draft.trim();
            if (t && !values.includes(t)) onChange([...values, t]);
            setDraft("");
          }
        }}
        placeholder="Type a title, press Enter"
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
      />
    </div>
  );
}

function ColdListPanel({
  icp,
  onSaved,
}: {
  icp: ChosenIcp | null;
  onSaved: (list: LeadListSummary) => void;
}) {
  const [jobTitles, setJobTitles] = useState<string[]>(
    icp?.roleTitles?.length ? icp.roleTitles : ["Owner", "Founder", "CEO", "Managing Director"]
  );
  const [teamSize, setTeamSize] = useState(icp?.teamSize || "11-50");
  const [revenueRange, setRevenueRange] = useState(icp?.revenueRange || "");
  const [location, setLocation] = useState(icp?.geography || "United Kingdom");
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ leads: LeadTeaser[]; totalMatched: number } | null>(
    null
  );

  async function handleSearch() {
    setSearching(true);
    setError(null);
    const result = await apiPost<SearchResponse>("/api/coach/lead-finder/search", {
      categories: [],
      jobTitles,
      jobTitleExcludes: [],
      states: [],
      locations: location.trim() ? [location.trim()] : [],
      industries: icp?.industry ? [icp.industry] : [],
      companies: [],
      companyExcludes: [],
      teamSizes: teamSize ? [teamSize] : [],
      revenueRanges: revenueRange ? [revenueRange] : [],
      requireContacts: [],
      page: 1,
      pageSize: 100,
    });
    setSearching(false);
    if (!result.ok) {
      setError(result.error ?? "Search failed.");
      return;
    }
    setResult({
      leads: result.data?.leads ?? [],
      totalMatched: result.data?.totalMatched ?? result.data?.leads?.length ?? 0,
    });
  }

  async function handleSave() {
    if (!result) return;
    setSaving(true);
    setError(null);
    const saveResult = await apiPost<SaveListResponse>("/api/coach/lead-lists", {
      source: "lead_finder",
      name: icp ? `${icp.label} — cold list` : "Cold starter list",
      filters: { jobTitles, teamSize, revenueRange, location },
      leadIds: result.leads.map((l) => l.id),
      count: result.totalMatched,
    });
    setSaving(false);
    if (!saveResult.ok) {
      setError(saveResult.error ?? "Couldn't save the list.");
      return;
    }
    onSaved(
      saveResult.data?.leadList ?? {
        id: saveResult.data?.id ?? `local-${Date.now()}`,
        source: "lead_finder",
        count:
          saveResult.data?.itemCount ??
          saveResult.data?.count ??
          result.leads.length,
        createdAt: new Date().toISOString(),
      }
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card title="Cold: search our lead database">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel>Job titles</FieldLabel>
            <TagInput values={jobTitles} onChange={setJobTitles} />
          </div>
          <div>
            <FieldLabel>Location</FieldLabel>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            />
          </div>
          <div>
            <FieldLabel>Team size</FieldLabel>
            <select
              value={teamSize}
              onChange={(e) => setTeamSize(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            >
              <option value="">Any</option>
              {LEADROCKS_TEAM_SIZES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel>Revenue</FieldLabel>
            <select
              value={revenueRange}
              onChange={(e) => setRevenueRange(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            >
              <option value="">Any</option>
              {LEADROCKS_REVENUE_RANGES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <PrimaryButton onClick={() => void handleSearch()} loading={searching}>
            Search
          </PrimaryButton>
        </div>
      </Card>

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      {result ? (
        <Card
          title={`${result.totalMatched.toLocaleString()} matches`}
          actions={
            <PrimaryButton onClick={() => void handleSave()} loading={saving} disabled={result.leads.length === 0}>
              Save as starter list
            </PrimaryButton>
          }
        >
          {result.leads.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No matches — widen your filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">
                    <th className="py-2 pr-3">Name</th>
                    <th className="py-2 pr-3">Company</th>
                    <th className="py-2 pr-3">Location</th>
                    <th className="py-2 pr-3">Contact</th>
                  </tr>
                </thead>
                <tbody>
                  {result.leads.slice(0, 25).map((lead) => (
                    <tr key={lead.id} className="border-b border-slate-50">
                      <td className="py-2 pr-3">
                        <p className="font-medium text-slate-900">{lead.fullName ?? "—"}</p>
                        <p className="text-xs text-slate-500">{lead.jobTitle}</p>
                      </td>
                      <td className="py-2 pr-3 text-slate-600">{lead.company ?? "—"}</td>
                      <td className="py-2 pr-3 text-slate-600">{lead.location ?? "—"}</td>
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <Mail
                            className={`h-3.5 w-3.5 ${lead.hasEmail ? "text-emerald-600" : ""}`}
                          />
                          <Phone
                            className={`h-3.5 w-3.5 ${lead.hasPhone ? "text-emerald-600" : ""}`}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.leads.length > 25 ? (
                <p className="mt-2 text-xs text-slate-400">
                  +{result.leads.length - 25} more in the saved list
                </p>
              ) : null}
            </div>
          )}
        </Card>
      ) : null}
    </div>
  );
}

function WarmListPanel({
  icp,
  onSaved,
}: {
  icp: ChosenIcp | null;
  onSaved: (list: LeadListSummary) => void;
}) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [matched, setMatched] = useState<(ParsedLinkedInConnection & { id?: string })[] | null>(
    null
  );
  const [syncedWithServer, setSyncedWithServer] = useState(false);

  const extraKeywords = useMemo(() => icp?.roleTitles ?? [], [icp]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFileName(file.name);
    setError(null);
    setParsing(true);
    setMatched(null);
    setSyncedWithServer(false);

    const isZip = file.name.toLowerCase().endsWith(".zip");

    try {
      if (!isZip) {
        const text = await file.text();
        const parsed = parseConnectionsCsv(text);
        const localMatches = parsed.filter(
          (c) => matchConnectionTitles(c.position, extraKeywords).matched
        );
        setTotalCount(parsed.length);
        setMatched(localMatches);
      }
      // Zip: server extracts Connections.csv — skip local parse.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that file.");
      setParsing(false);
      return;
    }

    const uploadResult = await apiUploadFile<{
      batchId?: string;
      total?: number;
      titleMatchCount?: number;
      count?: number;
    }>("/api/coach/connections/upload", file, {
      extraKeywords: extraKeywords.join(","),
    });
    if (uploadResult.ok) {
      if (typeof uploadResult.data?.total === "number") {
        setTotalCount(uploadResult.data.total);
      }
      const matchResult = await apiPost<MatchResponse>("/api/coach/connections/match", {
        batchId: uploadResult.data?.batchId,
      });
      if (matchResult.ok && (matchResult.data?.matched || matchResult.data?.matches)) {
        const rows = mapConnectionRows(
          matchResult.data.matched ?? matchResult.data.matches ?? []
        );
        setMatched(rows);
        setTotalCount(
          matchResult.data.totalCount ??
            uploadResult.data?.total ??
            uploadResult.data?.count ??
            null
        );
        setSyncedWithServer(true);
      } else if (typeof uploadResult.data?.titleMatchCount === "number") {
        // Upload ok; keep local matches if we have them, mark synced for save fallback.
        if (typeof uploadResult.data.titleMatchCount === "number" && isZip) {
          setMatched([]);
        }
        setSyncedWithServer(true);
      }
    } else {
      setError(uploadResult.error ?? "Upload failed.");
    }
    setParsing(false);
  }

  async function handleSave() {
    if (!matched?.length && !syncedWithServer) return;
    setSaving(true);
    setError(null);

    // Prefer server connection ids when available
    const connectionIds = matched
      ?.map((m) => (m as ParsedLinkedInConnection & { id?: string }).id)
      .filter((id): id is string => Boolean(id));

    const saveResult = await apiPost<SaveListResponse>("/api/coach/lead-lists", {
      source: "connections",
      name: icp ? `${icp.label} — warm list` : "Warm starter list",
      connectionIds:
        connectionIds && connectionIds.length > 0
          ? connectionIds.slice(0, 250)
          : undefined,
      // Fallback: ask server to use latest title-matched batch
      useLatestConnectionMatches: !connectionIds?.length,
      count: matched?.length,
    });
    setSaving(false);
    if (!saveResult.ok) {
      setError(saveResult.error ?? "Couldn't save the list.");
      return;
    }
    onSaved(
      saveResult.data?.leadList ?? {
        id: saveResult.data?.id ?? `local-${Date.now()}`,
        source: "connections",
        count:
          saveResult.data?.itemCount ??
          saveResult.data?.count ??
          matched?.length ??
          0,
        createdAt: new Date().toISOString(),
      }
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card
        title="Warm: match your LinkedIn connections"
        description="Request your data from LinkedIn, then upload Connections.csv or the export zip here."
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <a
            href={LINKEDIN_DOWNLOAD_DATA_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open LinkedIn download page
          </a>
          <p className="text-xs text-slate-500">
            Tick <span className="font-medium text-slate-700">Connections</span>, request the
            archive, then upload when LinkedIn emails it (often within minutes).
          </p>
        </div>
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 px-6 py-8 text-center hover:bg-slate-50">
          <Upload className="h-5 w-5 text-slate-400" />
          <span className="text-sm font-medium text-slate-700">
            {fileName ? `Uploaded: ${fileName}` : "Choose Connections.csv or export zip"}
          </span>
          <span className="text-xs text-slate-400">
            CSV or LinkedIn Basic data-export zip
          </span>
          <input
            type="file"
            accept=".csv,.zip,text/csv,application/zip"
            className="sr-only"
            onChange={(e) => void handleFileChange(e)}
          />
        </label>
        {parsing ? <p className="mt-3 text-sm text-slate-500">Matching against your ICP…</p> : null}
      </Card>

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      {matched ? (
        <Card
          title={
            <span className="inline-flex items-center gap-2">
              <Users className="h-4 w-4 text-sky-600" />
              You already know {matched.length.toLocaleString()} people who look like this ICP
            </span>
          }
          description={
            totalCount ? `Out of ${totalCount.toLocaleString()} connections scanned.` : undefined
          }
          actions={
            <PrimaryButton onClick={() => void handleSave()} loading={saving} disabled={matched.length === 0}>
              Save as starter list
            </PrimaryButton>
          }
        >
          {!syncedWithServer ? (
            <p className="mb-3 text-xs text-amber-700">
              Matched locally by title keywords — will sync once the server match is available.
            </p>
          ) : null}
          {matched.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              No title matches — try uploading a different export.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">
                    <th className="py-2 pr-3">Name</th>
                    <th className="py-2 pr-3">Title</th>
                    <th className="py-2 pr-3">Company</th>
                    <th className="py-2 pr-3">Connected</th>
                  </tr>
                </thead>
                <tbody>
                  {matched.slice(0, 25).map((c, idx) => (
                    <tr key={`${c.linkedinUrl || c.firstName}-${idx}`} className="border-b border-slate-50">
                      <td className="py-2 pr-3">
                        {c.linkedinUrl ? (
                          <a
                            href={c.linkedinUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-sky-700 hover:underline"
                          >
                            {c.firstName} {c.lastName}
                          </a>
                        ) : (
                          <span className="font-medium text-slate-900">
                            {c.firstName} {c.lastName}
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-slate-600">{c.position || "—"}</td>
                      <td className="py-2 pr-3 text-slate-600">{c.company || "—"}</td>
                      <td className="py-2 pr-3 text-slate-500">{c.connectedOn || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {matched.length > 25 ? (
                <p className="mt-2 text-xs text-slate-400">+{matched.length - 25} more in the saved list</p>
              ) : null}
            </div>
          )}
        </Card>
      ) : null}
    </div>
  );
}

export function StepStarterList({
  icp,
  leadList,
  onSaved,
}: {
  icp: ChosenIcp | null;
  leadList: LeadListSummary | null;
  onSaved: (list: LeadListSummary) => void;
}) {
  const [tab, setTab] = useState<"cold" | "warm">("cold");
  const [phase, setPhase] = useState<"pick" | "building">(leadList ? "pick" : "pick");
  const [error, setError] = useState<string | null>(null);
  const progress = useCampaignProgressRunner();

  async function handleSaved(list: LeadListSummary) {
    setError(null);
    setPhase("building");
    try {
      await progress.runFlat([
        {
          id: "pack",
          label: "Packaging your starter list",
          minMs: 900,
        },
        {
          id: "messages",
          label: "Attaching approved outreach messages",
          minMs: 900,
        },
        {
          id: "csv",
          label: "Preparing your CSV export pack",
          minMs: 800,
        },
        {
          id: "ready",
          label: "Your first campaign is ready",
          minMs: 700,
        },
      ]);
      onSaved(list);
      setPhase("pick");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't finalise the list.");
      onSaved(list);
      setPhase("pick");
    }
  }

  if (phase === "building") {
    return (
      <div className="flex flex-col gap-5">
        <CampaignSetupProgress
          title="Building your starter list"
          subtitle="Almost there — packaging prospects and messages."
          stages={progress.stages}
        />
        {error ? <ErrorNote>{error}</ErrorNote> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <AiNote>
        Build your first 100–250 named prospects. Go cold from our lead
        database, warm from people you already know, or both.
      </AiNote>

      {leadList ? (
        <Card title="Starter list saved">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-900">
                {leadList.count.toLocaleString()} prospects
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Source:{" "}
                <Chip tone={leadList.source === "lead_finder" ? "sky" : "emerald"}>
                  {leadList.source === "lead_finder"
                    ? "Cold — Lead Finder"
                    : leadList.source === "mixed"
                      ? "Mixed"
                      : "Warm — Connections"}
                </Chip>
              </p>
            </div>
            <PrimaryButton
              onClick={() => {
                void (async () => {
                  const headers = await getAuthHeaders();
                  if (!headers) return;
                  const res = await fetch(
                    `/api/coach/campaign-setup/export?listId=${encodeURIComponent(leadList.id)}`,
                    { headers: { Authorization: headers.Authorization } }
                  );
                  if (!res.ok) return;
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${leadList.name || "starter-list"}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                })();
              }}
            >
              Download CSV pack
            </PrimaryButton>
          </div>
        </Card>
      ) : null}

      <div className="flex gap-2 rounded-lg border border-slate-200 bg-slate-50 p-1">
        {(
          [
            { id: "cold" as const, label: "Cold — Lead Finder" },
            { id: "warm" as const, label: "Warm — Connections" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold transition ${
              tab === t.id
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "cold" ? <ColdListPanel icp={icp} onSaved={handleSaved} /> : null}
      {tab === "warm" ? <WarmListPanel icp={icp} onSaved={handleSaved} /> : null}
    </div>
  );
}
