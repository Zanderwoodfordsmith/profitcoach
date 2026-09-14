"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Ban, Check, Plus, Search, Trash2 } from "lucide-react";
import { ProspectTableAvatar } from "@/components/prospects/ProspectTableAvatar";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import {
  audienceItemSourceLabel,
  displayListPersonName,
  type AudienceListSummary,
} from "@/lib/leadLists/audienceLists";

type CampaignOption = {
  id: string;
  name: string;
  status: string;
};

type ListItem = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  company: string | null;
  linkedin_url: string | null;
  source: string;
  in_campaign?: boolean;
};

type AddMode = "search" | "urls" | "one";

type SearchHit = {
  linkedin_url: string | null;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  title: string | null;
  linkedin_provider_id?: string | null;
};

type Props = {
  campaigns: CampaignOption[];
};

async function authHeaders() {
  return getCoachAuthHeaders();
}

export function CampaignAudiencePanel({ campaigns }: Props) {
  const [lists, setLists] = useState<AudienceListSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [addMode, setAddMode] = useState<AddMode | null>(null);
  const [campaignMenu, setCampaignMenu] = useState(false);

  const [searchUrl, setSearchUrl] = useState("");
  const [searchKeywords, setSearchKeywords] = useState("");
  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
  const [searchCursor, setSearchCursor] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [oneUrl, setOneUrl] = useState("");
  const [oneName, setOneName] = useState("");
  const [oneTitle, setOneTitle] = useState("");
  const [oneCompany, setOneCompany] = useState("");

  const selected = lists.find((list) => list.id === selectedId) ?? null;
  const isBlacklist = selected?.kind === "blacklist";
  const activeCampaigns = useMemo(
    () => campaigns.filter((campaign) => campaign.status !== "archived"),
    [campaigns]
  );

  const loadLists = useCallback(async (preferId?: string | null) => {
    const headers = await authHeaders();
    if (!headers) throw new Error("Sign in required.");
    const res = await fetch("/api/coach/lead-lists", { headers });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "Unable to load lists.");
    const next = Array.isArray(body.leadLists)
      ? (body.leadLists as AudienceListSummary[])
      : [];
    setLists(next);
    setSelectedId((current) => {
      if (preferId && next.some((list) => list.id === preferId)) return preferId;
      if (current && next.some((list) => list.id === current)) return current;
      return (
        next.find((list) => list.kind === "audience")?.id ??
        next[0]?.id ??
        null
      );
    });
    return next;
  }, []);

  const loadItems = useCallback(async (listId: string) => {
    const headers = await authHeaders();
    if (!headers) throw new Error("Sign in required.");
    const res = await fetch(
      `/api/coach/lead-lists?listId=${encodeURIComponent(listId)}`,
      { headers }
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "Unable to load this list.");
    setItems(Array.isArray(body.items) ? body.items : []);
    setSelectedIds([]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await loadLists();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load lists.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadLists]);

  useEffect(() => {
    if (!selectedId) {
      setItems([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setItemsLoading(true);
      setError(null);
      try {
        await loadItems(selectedId);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Unable to load this list."
          );
        }
      } finally {
        if (!cancelled) setItemsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId, loadItems]);

  const filteredItems = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return items;
    return items.filter((row) => {
      const hay = [
        displayListPersonName(row),
        row.job_title,
        row.company,
        row.linkedin_url,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(term);
    });
  }, [items, query]);

  const allVisibleSelected =
    filteredItems.length > 0 &&
    filteredItems.every((row) => selectedIds.includes(row.id));

  function toggleId(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function toggleAllVisible() {
    if (allVisibleSelected) {
      setSelectedIds((prev) =>
        prev.filter((id) => !filteredItems.some((row) => row.id === id))
      );
      return;
    }
    setSelectedIds((prev) => [
      ...new Set([...prev, ...filteredItems.map((row) => row.id)]),
    ]);
  }

  async function createList() {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("Sign in required.");
      const res = await fetch("/api/coach/lead-lists", {
        method: "POST",
        headers,
        body: JSON.stringify({ name }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not create list.");
      const createdId =
        typeof body.leadList?.id === "string"
          ? body.leadList.id
          : typeof body.list?.id === "string"
            ? body.list.id
            : null;
      setNewName("");
      setShowCreate(false);
      await loadLists(createdId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create list.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteList() {
    if (!selected || isBlacklist) return;
    if (
      !window.confirm(
        `Delete “${selected.name}”? People on it are not deleted from Prospects.`
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("Sign in required.");
      const res = await fetch(
        `/api/coach/lead-lists/${encodeURIComponent(selected.id)}`,
        { method: "DELETE", headers }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not delete list.");
      setSelectedId(null);
      await loadLists();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete list.");
    } finally {
      setBusy(false);
    }
  }

  async function addPeople(payload: Record<string, unknown>) {
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("Sign in required.");
      const res = await fetch(
        `/api/coach/lead-lists/${encodeURIComponent(selectedId)}/items`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not add people.");
      const added = Number(body.added ?? 0);
      const skipped = Number(body.skipped ?? 0);
      const blocked = Number(body.blacklisted ?? 0);
      const parts = [
        added ? `${added} added` : null,
        skipped ? `${skipped} already on this list` : null,
        blocked ? `${blocked} on your blacklist` : null,
      ].filter(Boolean);
      setNotice(parts.join(" · ") || "No new people were added.");
      setPasteText("");
      setOneUrl("");
      setOneName("");
      setOneTitle("");
      setOneCompany("");
      await loadItems(selectedId);
      await loadLists(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add people.");
    } finally {
      setBusy(false);
    }
  }

  async function runSearch(cursor?: string | null) {
    setBusy(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("Sign in required.");
      const res = await fetch("/api/coach/linkedin-outreach/search", {
        method: "POST",
        headers,
        body: JSON.stringify(
          cursor
            ? { cursor }
            : searchUrl.trim()
              ? { url: searchUrl.trim() }
              : { keywords: searchKeywords.trim() }
        ),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Search failed.");
      setSearchHits(Array.isArray(body.items) ? body.items : []);
      setSearchCursor(body.cursor ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setBusy(false);
    }
  }

  async function removeSelected() {
    if (!selectedId || !selectedIds.length) return;
    setBusy(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("Sign in required.");
      const res = await fetch(
        `/api/coach/lead-lists/${encodeURIComponent(selectedId)}/items`,
        {
          method: "DELETE",
          headers,
          body: JSON.stringify({ item_ids: selectedIds }),
        }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not remove people.");
      await loadItems(selectedId);
      await loadLists(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove people.");
    } finally {
      setBusy(false);
    }
  }

  async function blacklistSelected() {
    if (!selectedId || isBlacklist || !selectedIds.length) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("Sign in required.");
      const res = await fetch(
        `/api/coach/lead-lists/${encodeURIComponent(selectedId)}/items`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            action: "move_to_blacklist",
            item_ids: selectedIds,
          }),
        }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not blacklist.");
      setNotice(
        `${Number(body.moved ?? selectedIds.length)} moved to blacklist`
      );
      await loadItems(selectedId);
      await loadLists(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not blacklist.");
    } finally {
      setBusy(false);
    }
  }

  async function addToCampaign(campaignId: string) {
    if (!selectedId || isBlacklist) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    setCampaignMenu(false);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("Sign in required.");
      const res = await fetch(
        `/api/coach/lead-lists/${encodeURIComponent(selectedId)}/add-to-campaign`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            campaign_id: campaignId,
            item_ids: selectedIds,
          }),
        }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not add to campaign.");
      const added = Number(body.added ?? 0);
      const skipped = Number(body.skipped ?? 0);
      const blocked = Number(body.blacklisted ?? 0);
      const parts = [
        added ? `${added} added to campaign` : null,
        skipped && !blocked ? `${skipped} skipped` : null,
        blocked ? `${blocked} blocked by blacklist` : null,
      ].filter(Boolean);
      setNotice(parts.join(" · ") || "No new people were added.");
      await loadItems(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add to campaign.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="px-5 py-16 text-center text-sm text-slate-600">
        Loading lists…
      </div>
    );
  }

  const audienceLists = lists.filter((list) => list.kind !== "blacklist");
  const blacklist = lists.find((list) => list.kind === "blacklist") ?? null;

  return (
    <div className="grid min-h-[32rem] lg:grid-cols-[16.5rem_minmax(0,1fr)]">
      <aside className="border-b border-slate-100 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Lists
          </p>
          <button
            type="button"
            onClick={() => setShowCreate((value) => !value)}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-[#0c5290] hover:bg-sky-50"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            New
          </button>
        </div>
        {showCreate ? (
          <div className="flex gap-2 border-b border-slate-100 px-3 pb-3">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Manufacturing owners"
              className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#0c5290]/30"
              onKeyDown={(e) => {
                if (e.key === "Enter") void createList();
                if (e.key === "Escape") setShowCreate(false);
              }}
            />
            <button
              type="button"
              disabled={busy || !newName.trim()}
              onClick={() => void createList()}
              className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              Add
            </button>
          </div>
        ) : null}
        <nav className="max-h-[14rem] overflow-y-auto px-2 pb-3 lg:max-h-[36rem]">
          {blacklist ? (
            <button
              type="button"
              onClick={() => setSelectedId(blacklist.id)}
              className={
                selectedId === blacklist.id
                  ? "mb-1 flex w-full items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-left text-rose-900"
                  : "mb-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-slate-700 hover:bg-slate-50"
              }
            >
              <Ban className="h-3.5 w-3.5 shrink-0 text-rose-700" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                Blacklist
              </span>
              <span className="text-[11px] text-rose-700">
                {blacklist.item_count}
              </span>
            </button>
          ) : null}
          {audienceLists.length === 0 ? (
            <p className="px-3 py-4 text-xs text-slate-600">
              No lists yet. Create one, then import a search or add people one by
              one.
            </p>
          ) : (
            audienceLists.map((list) => {
              const on = selectedId === list.id;
              return (
                <button
                  key={list.id}
                  type="button"
                  onClick={() => setSelectedId(list.id)}
                  className={
                    on
                      ? "mb-0.5 flex w-full items-center gap-2 rounded-xl bg-sky-50 px-3 py-2 text-left text-sky-900"
                      : "mb-0.5 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-slate-700 hover:bg-slate-50"
                  }
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {list.name}
                  </span>
                  <span className="text-[11px] text-sky-800">
                    {list.item_count}
                  </span>
                </button>
              );
            })
          )}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-col">
        {!selected ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-medium text-slate-900">
              Build the next batch before a campaign
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
              Lists are inventory — people you might message. Prospects is the
              pipeline of people you are already working.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  {isBlacklist ? "Blacklist" : selected.name}
                </h2>
                <p className="mt-0.5 text-xs text-slate-600">
                  {isBlacklist
                    ? "Never enrolled in any campaign, even if they appear in a search."
                    : "Not your pipeline. Add this list to a campaign when you are ready to message them."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {isBlacklist ? null : (
                  <div className="relative">
                    <button
                      type="button"
                      disabled={
                        busy || (!selectedIds.length && items.length === 0)
                      }
                      onClick={() => setCampaignMenu((value) => !value)}
                      className="rounded-xl bg-[#0c5290] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0a457a] disabled:opacity-50"
                    >
                      {selectedIds.length
                        ? `Add ${selectedIds.length} to campaign`
                        : "Add list to campaign"}
                    </button>
                    {campaignMenu ? (
                      <div className="absolute right-0 z-20 mt-1 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                        {activeCampaigns.length === 0 ? (
                          <p className="px-3 py-3 text-xs text-slate-600">
                            Create a campaign first, then add this list to it.
                          </p>
                        ) : (
                          activeCampaigns.map((campaign) => (
                            <button
                              key={campaign.id}
                              type="button"
                              className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                              onClick={() => void addToCampaign(campaign.id)}
                            >
                              {campaign.name}
                            </button>
                          ))
                        )}
                      </div>
                    ) : null}
                  </div>
                )}
                {isBlacklist ? null : (
                  <button
                    type="button"
                    disabled={busy || !selectedIds.length}
                    onClick={() => void blacklistSelected()}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Blacklist
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy || !selectedIds.length}
                  onClick={() => void removeSelected()}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Remove
                </button>
                {isBlacklist ? null : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void deleteList()}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-rose-700 hover:bg-rose-50"
                    aria-label="Delete list"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 border-b border-slate-100 px-5 py-3">
              {(
                [
                  ["search", "Search"],
                  ["urls", "Paste URLs"],
                  ["one", "Add one"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() =>
                    setAddMode((current) => (current === id ? null : id))
                  }
                  className={
                    addMode === id
                      ? "rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
                      : "rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  }
                >
                  {label}
                </button>
              ))}
            </div>

            {addMode ? (
              <div className="space-y-3 border-b border-slate-100 bg-slate-50 px-5 py-4">
                {addMode === "search" ? (
                  <>
                    <input
                      value={searchUrl}
                      onChange={(e) => setSearchUrl(e.target.value)}
                      placeholder="Sales Nav or LinkedIn search URL"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
                    />
                    <input
                      value={searchKeywords}
                      onChange={(e) => setSearchKeywords(e.target.value)}
                      placeholder="Or keywords…"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={
                          busy || (!searchUrl.trim() && !searchKeywords.trim())
                        }
                        onClick={() => void runSearch(null)}
                        className="rounded-lg bg-[#0c5290] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        Search
                      </button>
                      {searchCursor ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void runSearch(searchCursor)}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium"
                        >
                          Next page
                        </button>
                      ) : null}
                      {searchHits.length ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void addPeople({
                              source: "search",
                              people: searchHits
                                .filter((hit) => hit.linkedin_url)
                                .map((hit) => ({
                                  linkedin_url: hit.linkedin_url,
                                  first_name: hit.first_name,
                                  last_name: hit.last_name,
                                  company: hit.company,
                                  title: hit.title,
                                  linkedin_provider_id: hit.linkedin_provider_id,
                                })),
                            })
                          }
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium"
                        >
                          Save {searchHits.filter((hit) => hit.linkedin_url).length}{" "}
                          to list
                        </button>
                      ) : null}
                    </div>
                    {searchHits.length ? (
                      <ul className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                        {searchHits.map((hit, index) => (
                          <li
                            key={`${hit.linkedin_url ?? "row"}-${index}`}
                            className="flex items-center gap-3 px-3 py-2 text-sm"
                          >
                            <ProspectTableAvatar
                              name={displayListPersonName(hit)}
                            />
                            <div className="min-w-0">
                              <div className="truncate font-medium text-slate-900">
                                {displayListPersonName(hit)}
                              </div>
                              <div className="truncate text-xs text-slate-600">
                                {[hit.title, hit.company]
                                  .filter(Boolean)
                                  .join(" · ") || "—"}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </>
                ) : addMode === "urls" ? (
                  <>
                    <textarea
                      value={pasteText}
                      onChange={(e) => setPasteText(e.target.value)}
                      rows={5}
                      placeholder="One LinkedIn URL per line. Optional: url, first, last, company, title"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
                    />
                    <button
                      type="button"
                      disabled={busy || !pasteText.trim()}
                      onClick={() => void addPeople({ text: pasteText })}
                      className="rounded-lg bg-[#0c5290] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      Add URLs
                    </button>
                  </>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      value={oneUrl}
                      onChange={(e) => setOneUrl(e.target.value)}
                      placeholder="LinkedIn profile URL"
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm sm:col-span-2"
                    />
                    <input
                      value={oneName}
                      onChange={(e) => setOneName(e.target.value)}
                      placeholder="Name"
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
                    />
                    <input
                      value={oneTitle}
                      onChange={(e) => setOneTitle(e.target.value)}
                      placeholder="Title"
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
                    />
                    <input
                      value={oneCompany}
                      onChange={(e) => setOneCompany(e.target.value)}
                      placeholder="Company"
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm sm:col-span-2"
                    />
                    <button
                      type="button"
                      disabled={busy || !oneUrl.trim()}
                      onClick={() =>
                        void addPeople({
                          people: [
                            {
                              linkedin_url: oneUrl,
                              full_name: oneName,
                              title: oneTitle,
                              company: oneCompany,
                            },
                          ],
                        })
                      }
                      className="rounded-lg bg-[#0c5290] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      Add person
                    </button>
                  </div>
                )}
              </div>
            ) : null}

            <div className="px-5 py-3">
              {error ? (
                <p className="mb-3 text-sm text-rose-700">{error}</p>
              ) : null}
              {notice ? (
                <p className="mb-3 text-sm text-slate-700">{notice}</p>
              ) : null}
              <label className="relative block max-w-xs">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                  strokeWidth={1.75}
                  aria-hidden
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search this list…"
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none placeholder:text-slate-500 focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                />
              </label>
            </div>

            <div className="mx-5 mb-5 overflow-hidden rounded-lg border border-slate-200">
              <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  disabled={!filteredItems.length}
                  onChange={toggleAllVisible}
                  aria-label="Select all people on this list"
                  className="rounded border-slate-300 text-[#0c5290]"
                />
                <span className="text-xs font-medium text-slate-700">
                  {filteredItems.length}{" "}
                  {filteredItems.length === 1 ? "person" : "people"}
                </span>
              </div>
              <ul className="max-h-[28rem] overflow-y-auto">
                {itemsLoading ? (
                  <li className="px-3 py-10 text-center text-sm text-slate-600">
                    Loading people…
                  </li>
                ) : filteredItems.length === 0 ? (
                  <li className="px-3 py-10 text-center text-sm text-slate-600">
                    {items.length === 0
                      ? isBlacklist
                        ? "Nobody is blacklisted yet."
                        : "This list is empty. Search, paste URLs, or add one person."
                      : "No matches on this list."}
                  </li>
                ) : (
                  filteredItems.map((row) => {
                    const name = displayListPersonName(row);
                    return (
                      <li key={row.id}>
                        <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-slate-50">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(row.id)}
                            disabled={busy}
                            onChange={() => toggleId(row.id)}
                            className="rounded border-slate-300 text-[#0c5290]"
                          />
                          <ProspectTableAvatar name={name} />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-slate-900">
                              {name}
                            </div>
                            <div className="truncate text-xs text-slate-600">
                              {[row.job_title, row.company]
                                .filter(Boolean)
                                .join(" · ") || "—"}
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-0.5">
                            <span className="text-[11px] font-medium text-slate-600">
                              {audienceItemSourceLabel(row.source)}
                            </span>
                            {row.in_campaign ? (
                              <span className="inline-flex items-center gap-0.5 text-[11px] text-emerald-800">
                                <Check className="h-3 w-3" aria-hidden />
                                In a campaign
                              </span>
                            ) : null}
                          </div>
                        </label>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
