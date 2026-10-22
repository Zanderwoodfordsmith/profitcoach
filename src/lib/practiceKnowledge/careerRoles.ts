import type { LinkedInExperience } from "@/lib/apify/linkedinProfileTypes";
import type { CareerRole } from "./types";

function year(raw: string | null | undefined): string {
  return raw?.match(/(19|20)\d{2}/)?.[0] ?? "";
}

function stillThere(raw: string | null | undefined): boolean {
  return !raw || /present|now|current/i.test(raw);
}

/** The LinkedIn roles as career rows, newest first, all shown. Same role twice at one company counts once. */
export function careerFromExperiences(experiences: LinkedInExperience[] | null | undefined): CareerRole[] {
  const seen = new Set<string>();
  const rows: CareerRole[] = [];
  for (const e of experiences ?? []) {
    const title = e.title?.trim() ?? "";
    const company = e.company?.trim() ?? "";
    if (!title && !company) continue;
    const key = `${title}|${company}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      id: crypto.randomUUID(),
      kind: "job",
      title,
      company,
      industry: e.industry?.trim() ?? "",
      from: year(e.start),
      to: stillThere(e.end) ? "" : year(e.end),
      note: "",
      show: true,
    });
  }
  return rows;
}

/** When there is no LinkedIn import to start from: the titles we already hold, one row each. */
export function careerFromTitles(titles: string[]): CareerRole[] {
  return titles.map((title) => ({ id: crypto.randomUUID(), kind: "job", title, company: "", industry: "", from: "", to: "", note: "", show: true }));
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((v) => {
    const key = v.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** What the older answers hold, from the shown rows: the titles, and the industries then companies. */
export function careerLists(rows: CareerRole[]): { roles: string[]; industries: string[] } {
  const shown = rows.filter((r) => r.show);
  return {
    roles: unique(shown.map((r) => r.title)),
    industries: unique([...shown.map((r) => r.industry), ...shown.map((r) => r.company)]),
  };
}

/** "2016 to now", "2009 to 2016", or "". */
export function careerYears(r: CareerRole): string {
  if (r.from && !r.to) return `${r.from} to now`;
  if (r.from && r.to && r.from !== r.to) return `${r.from} to ${r.to}`;
  return r.to || r.from;
}

/** One plain line for the writers: "Finance Director at Kestrel Group (Construction), 2009 to 2016: rebuilt the finance team." */
export function careerLine(r: CareerRole): string {
  const head = [r.kind === "own" && !r.title ? "Ran their own business" : r.title, r.company && `at ${r.company}`].filter(Boolean).join(" ");
  const own = r.kind === "own" ? " (their own business)" : "";
  const industry = r.industry ? ` (${r.industry})` : "";
  const years = careerYears(r);
  return `${head}${own}${industry}${years ? `, ${years}` : ""}${r.note ? `: ${r.note}` : ""}`;
}
