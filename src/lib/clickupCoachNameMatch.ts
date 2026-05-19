/**
 * Match ClickUp Coach Success CSV names to coaches in the database.
 * Tuned for ~200 coaches — tolerates typos, nicknames, and spelling variants.
 */

export const CLICKUP_CSV_TO_COACH_SLUG: Record<string, string> = {
  // Confirmed CSV task name (normalized) → coaches.slug
  "paul biboud lubeck": "paulbiboud",
  "amber bartlett": "ambercerone",
  "pete janelle o keefe": "petersokeeffe",
};

const NICKNAME_GROUPS: string[][] = [
  ["andrew", "andy"],
  ["christopher", "chris"],
  ["stephen", "steve"],
  ["nicholas", "nick"],
  ["altaf", "altaff"],
  ["gordon", "gordan"],
  ["emlyn", "emelyn"],
  ["alexander", "alex"],
  ["robert", "rob", "bob"],
  ["joseph", "joe"],
  ["john", "johno", "jon"],
  ["lemon", "lemon"],
  ["cilla", "cilla"],
  ["goldberg", "goldberger"],
  ["jarrett", "jarret"],
  ["mclachlan", "mclachlan"],
  ["madeiros", "madeiros"],
];

const nicknameLookup = new Map<string, Set<string>>();
for (const group of NICKNAME_GROUPS) {
  const set = new Set(group);
  for (const name of group) nicknameLookup.set(name, set);
}

export function normalizeCoachName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function nameTokens(fullName: string): string[] {
  return normalizeCoachName(fullName).split(" ").filter(Boolean);
}

type NameParts = { first: string; last: string; all: string[] };

export function splitPersonName(fullName: string): NameParts | null {
  const all = nameTokens(fullName);
  if (all.length < 2) return null;
  return {
    first: all.slice(0, -1).join(" "),
    last: all[all.length - 1]!,
    all,
  };
}

export function isCompoundPersonName(fullName: string): boolean {
  return /\s(&|and)\s/i.test(fullName.trim());
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0]![j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1;
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,
        matrix[i]![j - 1]! + 1,
        matrix[i - 1]![j - 1]! + cost
      );
    }
  }
  return matrix[b.length]![a.length]!;
}

function sharesNickname(a: string, b: string): boolean {
  const setA = nicknameLookup.get(a);
  const setB = nicknameLookup.get(b);
  if (!setA || !setB) return false;
  for (const n of setA) {
    if (setB.has(n)) return true;
  }
  return false;
}

export function firstNamesMatch(csvFirst: string, dbFullName: string): boolean {
  const dbParts = splitPersonName(dbFullName);
  if (!dbParts) return false;

  const dbFirstTokens = dbParts.all.slice(0, -1);
  const csvFirstToken = csvFirst.split(" ")[0]!;

  if (csvFirst === dbParts.first) return true;
  if (dbFirstTokens.includes(csvFirstToken)) return true;

  const dbFirstToken = dbParts.first.split(" ")[0] ?? "";
  if (csvFirstToken === dbFirstToken) return true;
  if (sharesNickname(csvFirstToken, dbFirstToken)) return true;

  const minLen = Math.min(csvFirstToken.length, dbFirstToken.length);
  const maxDist = minLen >= 5 ? 2 : 1;
  if (levenshtein(csvFirstToken, dbFirstToken) <= maxDist) return true;

  const csvTokens = csvFirst.split(" ").filter(Boolean);
  if (csvTokens.length > 1 && dbFirstTokens.includes(csvTokens[0]!)) return true;

  return false;
}

export function lastNamesMatch(csvFullName: string, dbLast: string): boolean {
  const csvParts = splitPersonName(csvFullName);
  if (!csvParts) return false;

  const matchesToken = (token: string) => {
    if (token === dbLast) return true;
    if (token.length >= 5 && dbLast.length >= 5) {
      if (token.startsWith(dbLast) || dbLast.startsWith(token)) return true;
      const maxDist = Math.min(token.length, dbLast.length) >= 6 ? 2 : 1;
      if (levenshtein(token, dbLast) <= maxDist) return true;
    }
    return false;
  };

  if (matchesToken(csvParts.last)) return true;

  // Hyphenated / double surnames only (e.g. Paul Biboud-Lubeck), not 2-token names.
  if (csvParts.all.length >= 3) {
    const penultimate = csvParts.all[csvParts.all.length - 2]!;
    if (matchesToken(penultimate)) return true;
  }

  return false;
}

export type CoachNameMatchCandidate = {
  slug: string;
  fullName: string;
};

/**
 * Returns a single coach when CSV name plausibly matches one DB coach; otherwise null.
 */
export function matchCsvNameToCoach(
  csvTaskName: string,
  coaches: CoachNameMatchCandidate[]
): CoachNameMatchCandidate | null {
  if (isCompoundPersonName(csvTaskName)) return null;

  const aliasSlug = CLICKUP_CSV_TO_COACH_SLUG[normalizeCoachName(csvTaskName)];
  if (aliasSlug) {
    const aliasHit = coaches.filter((c) => c.slug === aliasSlug);
    if (aliasHit.length === 1) return aliasHit[0]!;
    if (aliasHit.length > 1) return null;
  }

  const csvParts = splitPersonName(csvTaskName);
  if (!csvParts) return null;

  const candidates = coaches.filter((coach) => {
    const dbParts = splitPersonName(coach.fullName);
    if (!dbParts) return false;
    if (!lastNamesMatch(csvTaskName, dbParts.last)) return false;
    return firstNamesMatch(csvParts.first, coach.fullName);
  });

  if (candidates.length !== 1) return null;
  return candidates[0]!;
}
