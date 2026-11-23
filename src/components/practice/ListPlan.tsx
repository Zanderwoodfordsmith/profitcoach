"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDown, Download, ExternalLink, Info, Loader2, Pencil, RefreshCw } from "lucide-react";

import { buttonClass } from "@/components/ui/Button";
import { fieldClass } from "@/components/ui/Field";
import type { ActivityItem, ProspectSearchDraft } from "@/lib/launch/jobActivity";
import { parseSalesNavSearchUrl } from "@/lib/salesNavigator/parseSalesNavFilters";
import { summarizeSalesNavSearch } from "@/lib/salesNavigator/salesNavSearchSummary";

/** Under this many people a list is too small for an automated campaign on its own (job 271). */
const SMALL_LIST = 300;

type Parts = {
  location: string | null;
  degrees: string[];
  titles: string[];
  excludes: string[];
  includes: string[];
  industries: string[];
  keywords: string | null;
  sizes: string[];
};

type Came = { label: string; list: string; count: number | null };

export type SearchEdit = { label: string; companyIncludes: string[]; industries: string[]; keywords: string; teamSizes: string[] };

const STAFF_BANDS = [
  { id: "1-10", label: "1 to 10" },
  { id: "11-50", label: "11 to 50" },
  { id: "51-200", label: "51 to 200" },
  { id: "201-500", label: "201 to 500" },
];

/** One row: searches that are the same apart from staff size, shown as one list. */
type Group = { key: string; label: string; searches: ProspectSearchDraft[]; parts: Parts; sizes: string[] };

function partsOf(url: string): Parts {
  try {
    const summary = summarizeSalesNavSearch(url);
    return {
      location: summary.location,
      degrees: summary.degrees,
      titles: summary.title_includes,
      excludes: summary.company_excludes,
      includes: summary.company_includes,
      industries: summary.industries,
      keywords: parseSalesNavSearchUrl(url).keywordsBoolean,
      sizes: summary.team_sizes,
    };
  } catch {
    return { location: null, degrees: [], titles: [], excludes: [], includes: [], industries: [], keywords: null, sizes: [] };
  }
}

/** What every list shares: shown once, so each row only shows what's different. */
function shared(all: string[][]): string[] {
  if (!all.length) return [];
  return all[0]!.filter((value) => all.every((list) => list.includes(value)));
}

function degreeWords(degrees: string[]): string {
  const names: Record<string, string> = { F: "1st", S: "2nd", O: "3rd", "1": "1st", "2": "2nd", "3": "3rd" };
  const words = degrees.map((d) => names[d] ?? d);
  return words.length ? `${words.join(" and ")} connections` : "";
}

function words(list: string[], max = 6): string {
  if (!list.length) return "–";
  return list.length > max ? `${list.slice(0, max).join(", ")} +${list.length - max} more` : list.join(", ");
}

/** "11-50" and "51-200" read as "11 to 200"; bands that don't touch stay apart. */
function staffWords(sizes: string[]): string {
  const bands: { lo: number; hi: number | null }[] = [];
  const other: string[] = [];
  for (const size of sizes) {
    const range = size.match(/^(\d[\d,]*)\s*-\s*(\d[\d,]*)$/);
    const plus = size.match(/^(\d[\d,]*)\+$/);
    if (range) bands.push({ lo: Number(range[1]!.replace(/,/g, "")), hi: Number(range[2]!.replace(/,/g, "")) });
    else if (plus) bands.push({ lo: Number(plus[1]!.replace(/,/g, "")), hi: null });
    else other.push(size);
  }
  bands.sort((a, b) => a.lo - b.lo);
  const merged: { lo: number; hi: number | null }[] = [];
  for (const band of bands) {
    const last = merged[merged.length - 1];
    if (last && last.hi !== null && band.lo <= last.hi + 1) last.hi = band.hi === null ? null : Math.max(last.hi, band.hi);
    else merged.push({ ...band });
  }
  const text = merged.map((b) => (b.hi === null ? `${b.lo.toLocaleString("en-GB")}+` : `${b.lo.toLocaleString("en-GB")} to ${b.hi.toLocaleString("en-GB")}`));
  return [...text, ...other].join(", ") || "Any";
}

/** "Access control businesses, 1 to 10" → "Access control businesses". */
function baseLabel(label: string): string {
  return label.replace(/,?\s*\(?\d[\d,]*\s*(?:to|-|–)\s*\d[\d,]*\)?(?:\s*staff)?\s*$/i, "").trim() || label;
}

function groupSearches(searches: ProspectSearchDraft[], parts: Parts[]): Group[] {
  const groups = new Map<string, Group>();
  searches.forEach((search, i) => {
    const p = parts[i]!;
    const key = JSON.stringify([baseLabel(search.label), p.includes, p.industries, p.keywords, p.titles, p.excludes, p.location, p.degrees]);
    const group = groups.get(key);
    if (group) {
      group.searches.push(search);
      group.sizes.push(...p.sizes);
    } else {
      groups.set(key, { key, label: baseLabel(search.label), searches: [search], parts: p, sizes: [...p.sizes] });
    }
  });
  return [...groups.values()];
}

function people(searches: ProspectSearchDraft[]): number | null {
  const known = searches.filter((s) => typeof s.size === "number");
  return known.length ? known.reduce((sum, s) => sum + (s.size ?? 0), 0) : null;
}

/**
 * Lead lists (job 248): how Ava will search and what came in. The base search
 * shows once, then one row per list, so BCA can see the approach, add an idea
 * or say what won't work (Ava replans), then import the ticked lists.
 */
export function ListPlan({
  item,
  busy,
  onReplan,
  onImport,
  onEdit,
  onSize,
  imported: came = [],
  readOnly = false,
}: {
  item: ActivityItem;
  busy: boolean;
  onReplan?: (text: string) => Promise<boolean>;
  onImport?: (picks: { id: string; on: boolean }[]) => Promise<boolean>;
  /** Change one row's search (all the searches shown as that row become one). */
  onEdit?: (searchIds: string[], edit: SearchEdit) => Promise<boolean>;
  /** Ask LinkedIn how many each list finds, without importing. */
  onSize?: () => Promise<boolean>;
  /** Lists that came in, with how many people are on each (the Blueprint's Lead lists page). */
  imported?: Came[];
  /** The coach's view: the plan and what came in, no changes. */
  readOnly?: boolean;
}) {
  const searches = useMemo(() => (item.payload.searches ?? []) as ProspectSearchDraft[], [item.payload.searches]);
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(searches.map((s) => [s.id, s.on])));
  const [note, setNote] = useState("");
  const [showThinking, setShowThinking] = useState(false);
  const [showBase, setShowBase] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const ticks = useMemo(() => Object.fromEntries(searches.map((s) => [s.id, on[s.id] ?? s.on])), [searches, on]);

  const parts = useMemo(() => searches.map((s) => partsOf(s.url)), [searches]);
  const groups = useMemo(() => groupSearches(searches, parts), [searches, parts]);
  const base = useMemo(
    () => ({
      location: parts.every((p) => p.location === parts[0]?.location) ? parts[0]?.location ?? null : null,
      degrees: shared(parts.map((p) => p.degrees)),
      titles: shared(parts.map((p) => p.titles)),
      excludes: shared(parts.map((p) => p.excludes)),
    }),
    [parts]
  );

  const imported = item.status !== "open";
  const canTick = !imported && !readOnly;
  // Before import every row says "Not imported", so on a narrow page that column waits until something comes in.
  const statusCol = imported ? "" : "hidden @5xl:table-cell";
  const hasName = groups.some((g) => g.parts.includes.length);
  const hasIndustry = groups.some((g) => g.parts.industries.length);
  const hasKeywords = groups.some((g) => g.parts.keywords);
  const staffs = groups.map((g) => staffWords(g.sizes));
  const sameStaff = staffs.length > 0 && staffs.every((x) => x === staffs[0]) ? staffs[0]! : null;
  const columns = 5 + (sameStaff ? 0 : 1) + (canTick ? 1 : 0) + (hasName ? 1 : 0) + (hasIndustry ? 1 : 0) + (hasKeywords ? 1 : 0);
  const anyRough = searches.some((s) => s.roughSize && typeof s.size === "number");

  const isOn = (g: Group) => g.searches.some((s) => ticks[s.id]);
  const tickedGroups = groups.filter(isOn);
  const tickedSearches = searches.filter((s) => ticks[s.id]);
  const total = people(tickedSearches);
  const thinking = typeof item.payload.thinking === "string" ? item.payload.thinking : "";
  const changes = typeof item.payload.changes === "string" ? item.payload.changes : "";

  const who = base.titles.length ? `Owners and bosses (${base.titles.length} job titles)` : "";
  const baseLine = [who, sameStaff ? `${sameStaff} staff` : "", base.location, degreeWords(base.degrees)].filter(Boolean).join(" · ");

  return (
    <div className="space-y-6">
      {thinking ? (
        <div className="max-w-[68ch] text-read text-slate-700">
          <p className={`whitespace-pre-wrap ${showThinking ? "" : "line-clamp-2"}`}>{thinking}</p>
          <button
            type="button"
            onClick={() => setShowThinking((v) => !v)}
            aria-expanded={showThinking}
            className="mt-1 inline-flex items-center gap-1 text-ui font-medium text-sky-700 hover:underline"
          >
            {showThinking ? "Show less" : "Read Ava's thinking"}
            <ChevronDown className={`size-4 transition-transform ${showThinking ? "rotate-180" : ""}`} aria-hidden />
          </button>
          {showThinking && changes ? <p className="mt-2 text-ui text-slate-500">Last change asked for: {changes}</p> : null}
        </div>
      ) : null}

      <div className="text-ui">
        <p className="flex flex-wrap items-center gap-x-2 text-slate-700">
          <span className="font-semibold text-slate-900">Every list finds</span>
          <span>{baseLine || "The lists don't share a base search."}</span>
          {base.titles.length || base.excludes.length ? (
            <button
              type="button"
              onClick={() => setShowBase((v) => !v)}
              aria-expanded={showBase}
              aria-label="Show the job titles and companies left out"
              className="rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <Info className="size-4" aria-hidden />
            </button>
          ) : null}
        </p>
        {showBase ? (
          <div className="mt-2 max-w-[68ch] space-y-1 rounded-lg bg-slate-50 px-2.5 py-2.5 text-slate-700">
            {base.titles.length ? <p><span className="text-slate-500">Job titles:</span> {base.titles.join(", ")}</p> : null}
            {base.excludes.length ? <p><span className="text-slate-500">Leaves out companies with:</span> {base.excludes.join(", ")}</p> : null}
          </div>
        ) : null}
      </div>

      {canTick ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-ui text-slate-600">
            {tickedGroups.length} of {groups.length} ticked
            {total != null ? ` · about ${anyRough ? "≈ " : ""}${total.toLocaleString("en-GB")} people` : ""}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy || !onSize}
              onClick={() => void onSize?.()}
              className={buttonClass("second", "normal")}
              title="Asks LinkedIn how many people each list finds. Nothing is imported."
            >
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
              Check sizes
            </button>
            <button
              type="button"
              disabled={busy || !tickedSearches.length}
              onClick={() => void onImport?.(searches.map((s) => ({ id: s.id, on: Boolean(ticks[s.id]) })))}
              className={buttonClass("main", "normal")}
              title="Runs on the coach's Sales Navigator, one list at a time, into their Pool."
            >
              <Download className="size-4" aria-hidden />
              Import {tickedGroups.length} {tickedGroups.length === 1 ? "list" : "lists"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[36rem] text-left text-ui">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              {canTick ? <th className="w-8 px-2.5 py-2.5" aria-label="Use this list" /> : null}
              <th className="px-2.5 py-2.5 font-medium">List</th>
              {hasName ? <th className="px-2.5 py-2.5 font-medium">Company name has</th> : null}
              {hasIndustry ? <th className="px-2.5 py-2.5 font-medium">Industry</th> : null}
              {hasKeywords ? <th className="px-2.5 py-2.5 font-medium">Keywords</th> : null}
              {sameStaff ? null : <th className="px-2.5 py-2.5 font-medium">Staff</th>}
              <th className="px-2.5 py-2.5 text-right font-medium">People</th>
              <th className="hidden px-2.5 py-2.5 font-medium @5xl:table-cell">Source</th>
              <th className={`${statusCol} px-2.5 py-2.5 font-medium`}>Status</th>
              <th className="w-8 px-2 py-2.5" aria-label="More" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {groups.map((group) => {
              const p = group.parts;
              const used = isOn(group);
              const expanded = open === group.key;
              const count = people(group.searches);
              const extraExcludes = p.excludes.filter((x) => !base.excludes.includes(x));
              const extraTitles = p.titles.filter((x) => !base.titles.includes(x));
              return (
                <Fragment key={group.key}>
                  <tr className={`${used ? "text-slate-800" : "text-slate-400"} ${expanded ? "bg-slate-50/70" : "hover:bg-slate-50/50"}`}>
                    {canTick ? (
                      <td className="px-2.5 py-2.5">
                        <input
                          type="checkbox"
                          checked={used}
                          disabled={busy}
                          onChange={(e) =>
                            setOn((prev) => ({ ...prev, ...Object.fromEntries(group.searches.map((s) => [s.id, e.target.checked])) }))
                          }
                          aria-label={`Use ${group.label}`}
                        />
                      </td>
                    ) : null}
                    <td className="px-2.5 py-2.5">
                      <button
                        type="button"
                        onClick={() => setOpen(expanded ? null : group.key)}
                        className={`block max-w-[10rem] truncate text-left font-medium @5xl:max-w-[13rem] ${used ? "text-slate-900" : ""} hover:underline`}
                        title={group.label}
                      >
                        {group.label}
                      </button>
                    </td>
                    {hasName ? <Cell text={p.includes.join(", ")} /> : null}
                    {hasIndustry ? <Cell text={p.industries.join(", ")} /> : null}
                    {hasKeywords ? <Cell text={p.keywords ?? ""} /> : null}
                    {sameStaff ? null : <td className="whitespace-nowrap px-2.5 py-2.5">{staffWords(group.sizes)}</td>}
                    <td
                      className="whitespace-nowrap px-2.5 py-2.5 text-right tabular-nums"
                      title={
                        count == null
                          ? "No count yet. Press Check sizes."
                          : group.searches.some((s) => s.roughSize)
                            ? "Rough: counted on BCA's LinkedIn, not the coach's"
                            : undefined
                      }
                    >
                      {count == null ? "–" : `${group.searches.some((s) => s.roughSize) ? "≈ " : ""}${count.toLocaleString("en-GB")}`}
                      {count != null && count < SMALL_LIST ? (
                        <span
                          className="ml-1.5 rounded bg-amber-50 px-1.5 py-0.5 text-caption text-amber-800 ring-1 ring-amber-200"
                          title={`Under ${SMALL_LIST} people: too small for a campaign on its own. Widen it or combine it with a similar list; fine for a one-off.`}
                        >
                          Small
                        </span>
                      ) : null}
                    </td>
                    <td className="hidden whitespace-nowrap px-2.5 py-2.5 @5xl:table-cell">
                      <a
                        href={group.searches[0]!.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sky-700 hover:underline"
                        title="Open this search in LinkedIn Sales Navigator"
                      >
                        Sales Nav <ExternalLink className="size-3.5" aria-hidden />
                      </a>
                    </td>
                    <td className={`${statusCol} whitespace-nowrap px-2.5 py-2.5`}>
                      <Status imported={imported} group={group} on={ticks} came={came} />
                    </td>
                    <td className="px-2 py-2.5">
                      <button
                        type="button"
                        onClick={() => setOpen(expanded ? null : group.key)}
                        aria-expanded={expanded}
                        aria-label={expanded ? `Hide ${group.label}` : `Show all of ${group.label}`}
                        className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      >
                        <ChevronDown className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden />
                      </button>
                    </td>
                  </tr>
                  {expanded ? (
                    <tr className="bg-slate-50/70">
                      <td colSpan={columns} className="px-3 pb-4 pt-1">
                        {editing === group.key ? (
                          <EditList
                            group={group}
                            busy={busy}
                            indent={canTick}
                            onCancel={() => setEditing(null)}
                            onSave={(edit) =>
                              onEdit
                                ? onEdit(
                                    group.searches.map((s) => s.id),
                                    edit
                                  ).then((ok) => {
                                    if (ok) {
                                      setEditing(null);
                                      setOpen(null);
                                    }
                                    return ok;
                                  })
                                : Promise.resolve(false)
                            }
                          />
                        ) : (
                        <div className={`max-w-[68ch] space-y-1.5 text-slate-700 ${canTick ? "pl-10" : ""}`}>
                          {group.searches[0]!.why ? <p>{group.searches[0]!.why}</p> : null}
                          {p.includes.length ? <Line label="Company name has" value={p.includes.join(", ")} /> : null}
                          {p.industries.length ? <Line label="Industry" value={p.industries.join(", ")} /> : null}
                          {p.keywords ? <Line label="Keywords" value={p.keywords} /> : null}
                          {extraTitles.length ? <Line label="Also job titles" value={words(extraTitles, 20)} /> : null}
                          {extraExcludes.length ? <Line label="Also leaves out" value={words(extraExcludes, 20)} /> : null}
                          {group.searches.length ? (
                            <ul className="pt-1">
                              {group.searches.map((s) => (
                                <li key={s.id} className="flex flex-wrap items-center gap-x-3">
                                  <span>{staffWords(partsOf(s.url).sizes)} staff</span>
                                  <span className="tabular-nums text-slate-500">
                                    {typeof s.size === "number" ? `${s.roughSize ? "≈ " : ""}${s.size.toLocaleString("en-GB")} people` : "No count yet"}
                                  </span>
                                  <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sky-700 hover:underline">
                                    Sales Navigator <ExternalLink className="size-3.5" aria-hidden />
                                  </a>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                          {canTick && onEdit ? (
                            <button type="button" onClick={() => setEditing(group.key)} className={buttonClass("second", "small", "mt-2")}>
                              <Pencil className="size-3.5" aria-hidden /> Edit this list
                            </button>
                          ) : null}
                        </div>
                        )}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {canTick ? (
        <>
          <div className="max-w-[44rem] border-t border-slate-100 pt-6">
            <label htmlFor="list-note" className="text-ui font-medium text-slate-900">
              Ask Ava to change the plan
            </label>
            <textarea
              id="list-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="e.g. Add a list for IT support firms with telecoms in the name. Drop the 1 to 10 lists, too many sole traders."
              className={fieldClass("textarea", "normal", "mt-2 w-full")}
            />
            <button
              type="button"
              disabled={busy || !note.trim()}
              onClick={() => void onReplan?.(note.trim()).then((ok) => ok && setNote(""))}
              className={buttonClass("second", "small", "mt-2")}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Plan the lists again
            </button>
          </div>
        </>
      ) : (
        <p className="text-ui text-slate-600">
          {tickedGroups.length} {tickedGroups.length === 1 ? "list" : "lists"}
          {total != null ? ` · about ${total.toLocaleString("en-GB")} people` : ""}
        </p>
      )}
    </div>
  );
}

/** One line, cut short with the rest on hover; the row opens to show it all. */
function Cell({ text }: { text: string }) {
  return (
    <td className="px-2.5 py-2.5">
      <span className="block max-w-[7rem] truncate @5xl:max-w-[11rem]" title={text || undefined}>
        {text || <span className="text-slate-300">–</span>}
      </span>
    </td>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="text-slate-500">{label}:</span> {value}
    </p>
  );
}

/** Not imported yet, waiting its turn, coming into the Pool (with how many so far), or not used. */
function Status({ imported, group, on, came }: { imported: boolean; group: Group; on: Record<string, boolean>; came: Came[] }) {
  if (!imported) return <span className="text-slate-500">Not imported</span>;
  const picked = group.searches.filter((s) => on[s.id]);
  if (!picked.length) return <span className="text-slate-400">Not used</span>;
  const started = picked.map((s) => came.find((c) => c.label === s.label)).filter((c): c is Came => Boolean(c));
  if (!started.length) return <span className="text-slate-500">Queued</span>;
  const count = started.reduce((sum, c) => sum + (c.count ?? 0), 0);
  return (
    <span className="inline-flex items-center gap-1.5 text-slate-900">
      <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
      In Pool · <span className="tabular-nums">{count.toLocaleString("en-GB")}</span>
      {started.length < picked.length ? <span className="text-slate-500">so far</span> : null}
    </span>
  );
}

function splitList(text: string): string[] {
  return text
    .split(",")
    .map((w) => w.trim())
    .filter(Boolean);
}

/** Change one list: name, company-name words, industry, keywords, staff. The base search stays. */
function EditList({
  group,
  busy,
  indent,
  onSave,
  onCancel,
}: {
  group: Group;
  busy: boolean;
  indent: boolean;
  onSave: (edit: SearchEdit) => Promise<boolean>;
  onCancel: () => void;
}) {
  const p = group.parts;
  const [label, setLabel] = useState(group.label);
  const [names, setNames] = useState(p.includes.join(", "));
  const [industries, setIndustries] = useState(p.industries.join(", "));
  const [keywords, setKeywords] = useState(p.keywords ?? "");
  const [sizes, setSizes] = useState<string[]>(() => [...new Set(group.sizes)]);
  const both = splitList(names).length > 0 && splitList(industries).length > 0;
  const nameAndKeywords = splitList(names).length > 0 && keywords.trim().length > 0;
  const id = group.key.replace(/[^a-z0-9]/gi, "").slice(0, 24);

  return (
    <form
      className={`grid max-w-[44rem] gap-3 pt-1 ${indent ? "pl-10" : ""}`}
      onSubmit={(e) => {
        e.preventDefault();
        void onSave({ label, companyIncludes: splitList(names), industries: splitList(industries), keywords, teamSizes: sizes });
      }}
    >
      <EditField id={`${id}-label`} label="List name">
        <input id={`${id}-label`} value={label} onChange={(e) => setLabel(e.target.value)} className={fieldClass("input", "normal", "w-full")} />
      </EditField>
      <EditField id={`${id}-names`} label="Company name has" hint="Words in the company's name, with commas between">
        <input id={`${id}-names`} value={names} onChange={(e) => setNames(e.target.value)} className={fieldClass("input", "normal", "w-full")} />
      </EditField>
      <EditField id={`${id}-industries`} label="Industry" hint="LinkedIn's exact industry names, with commas between">
        <input id={`${id}-industries`} value={industries} onChange={(e) => setIndustries(e.target.value)} className={fieldClass("input", "normal", "w-full")} />
      </EditField>
      <EditField id={`${id}-keywords`} label="Keywords" hint="Searches the whole profile. Only when company names don't work">
        <input id={`${id}-keywords`} value={keywords} onChange={(e) => setKeywords(e.target.value)} className={fieldClass("input", "normal", "w-full")} />
      </EditField>
      {both ? (
        <p className="text-ui text-amber-800">
          Company name and industry together make the list very small, and LinkedIn&apos;s industries are often wrong. Use one unless you mean both.
        </p>
      ) : null}
      {nameAndKeywords ? <p className="text-ui text-rose-700">Use company-name words or keywords, not both.</p> : null}
      <fieldset>
        <legend className="text-ui font-medium text-slate-900">Staff</legend>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
          {STAFF_BANDS.map((band) => (
            <label key={band.id} className="inline-flex items-center gap-1.5 text-ui text-slate-700">
              <input
                type="checkbox"
                checked={sizes.includes(band.id)}
                onChange={(e) => setSizes((prev) => (e.target.checked ? [...prev, band.id] : prev.filter((x) => x !== band.id)))}
              />
              {band.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex items-center gap-2">
        <button type="submit" disabled={busy || nameAndKeywords || !sizes.length} className={buttonClass("main", "small")}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Save and count
        </button>
        <button type="button" onClick={onCancel} className={buttonClass("quiet", "small")}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function EditField({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="text-ui font-medium text-slate-900">
        {label}
      </label>
      {hint ? <span className="ml-2 text-ui text-slate-500">{hint}</span> : null}
      <div className="mt-1">{children}</div>
    </div>
  );
}
