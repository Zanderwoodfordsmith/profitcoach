/**
 * Turning what someone typed into search terms Ava's searches understand.
 *
 * Each query word becomes a group of alternatives, so "Pamela Woodford" is
 * ["pamela|pam|pammy", "woodford"]. The database scores a row by how many
 * groups it matches (a word start counts fully, a near spelling partly); see
 * supabase/migrations/20271026120000_ava_search_memory.sql. matchScore below
 * does the same in code for small things already loaded (lists, campaigns,
 * Blueprint text).
 */

/** Names people shorten. Every name in a set finds the others. */
const NAME_SETS: string[][] = [
  ["pam", "pamela", "pammy"],
  ["dave", "david", "davy", "davey"],
  ["mike", "michael", "mick", "mikey", "mickey"],
  ["bob", "rob", "robert", "bobby", "robbie", "bert"],
  ["bill", "will", "william", "billy", "liam", "willy"],
  ["jim", "james", "jimmy", "jamie"],
  ["tom", "thomas", "tommy"],
  ["chris", "christopher", "kit"],
  ["chris", "christine", "christina", "chrissie", "tina"],
  ["nick", "nicholas", "nicky", "nic"],
  ["nicky", "nicola", "nikki"],
  ["matt", "matthew", "matty"],
  ["andy", "andrew", "drew"],
  ["tony", "anthony", "ant"],
  ["steve", "stephen", "steven", "stevie"],
  ["ben", "benjamin", "benny"],
  ["sam", "samuel", "sammy"],
  ["sam", "samantha", "sammie"],
  ["alex", "alexander", "alec", "xander", "zander", "sandy"],
  ["alex", "alexandra", "alexa", "sandra", "sandy"],
  ["dan", "daniel", "danny"],
  ["dani", "danielle"],
  ["joe", "joseph", "joey"],
  ["jo", "joanne", "joanna", "josephine", "jojo"],
  ["kate", "katherine", "catherine", "kathryn", "katie", "cathy", "kath", "kat", "kathy"],
  ["liz", "elizabeth", "beth", "lizzie", "betty", "eliza", "libby"],
  ["sue", "susan", "suzanne", "susie", "suzy"],
  ["jen", "jenny", "jennifer"],
  ["jess", "jessica", "jessie"],
  ["rich", "richard", "rick", "ricky", "dick", "richie"],
  ["ed", "edward", "eddie", "ted", "ned"],
  ["pete", "peter"],
  ["phil", "philip", "phillip"],
  ["tim", "timothy"],
  ["greg", "gregory"],
  ["jon", "jonathan", "john", "johnny", "jack"],
  ["nat", "nathan", "nathaniel"],
  ["nat", "natalie", "natasha", "tash"],
  ["vic", "victoria", "vicky", "vikki", "tori"],
  ["becky", "rebecca", "becca", "bec"],
  ["maggie", "margaret", "meg", "peggy", "marg", "maggi"],
  ["deb", "debbie", "deborah", "debra"],
  ["geoff", "geoffrey", "jeff", "jeffrey"],
  ["ken", "kenneth", "kenny"],
  ["len", "leonard", "lenny", "leo"],
  ["ray", "raymond"],
  ["ron", "ronald", "ronnie"],
  ["don", "donald", "donny"],
  ["gerry", "gerald", "gerard", "jerry"],
  ["fred", "frederick", "freddie", "freddy"],
  ["harry", "henry", "hal"],
  ["charlie", "charles", "chas", "chuck"],
  ["al", "alan", "allan", "alastair", "alistair", "albert"],
  ["ali", "alison", "allison", "alice"],
  ["mandy", "amanda"],
  ["val", "valerie"],
  ["di", "diana", "diane"],
  ["pat", "patrick", "paddy"],
  ["pat", "patricia", "trish", "tricia"],
  ["gill", "gillian", "jill"],
  ["jackie", "jacqueline"],
  ["stu", "stuart", "stewart"],
  ["si", "simon"],
  ["gaz", "gary", "gareth"],
  ["baz", "barry"],
  ["les", "leslie", "lesley"],
  ["mo", "maureen", "mohammed", "muhammad", "mohammad"],
];

const NICKNAMES = new Map<string, Set<string>>();
for (const set of NAME_SETS) {
  for (const name of set) {
    const alts = NICKNAMES.get(name) ?? new Set<string>();
    for (const other of set) if (other !== name) alts.add(other);
    NICKNAMES.set(name, alts);
  }
}

/** Words that carry no meaning in a search like "find the guy called John at Acme". */
const FILLER = new Set(
  (
    "a an the at of and or from in on for to with by about called named who whose is are was were " +
    "do does did done have has had what when where why how which that this these those us " +
    "my me i we our you your his her their find look search show someone somebody person people guy " +
    "lady man woman prospect coach contact ltd limited inc llc plc"
  ).split(" ")
);

const MAX_WORDS = 6;

/** Lowercase, accents off, everything but letters and digits to spaces. */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** The meaningful words of a query, in order, without repeats. */
export function queryWords(query: string): string[] {
  const all = normalizeText(query).split(" ").filter(Boolean);
  const kept = all.filter((word) => !FILLER.has(word));
  return [...new Set(kept.length ? kept : all)].slice(0, MAX_WORDS);
}

/** One group per word: the word, its singular, and the names it is short for (or shortened to). */
export function queryGroups(query: string): string[] {
  return queryWords(query).map((word) => {
    const singular = word.length > 4 && word.endsWith("s") && !word.endsWith("ss") ? [word.slice(0, -1)] : [];
    return [...new Set([word, ...singular, ...(NICKNAMES.get(word) ?? [])])].join("|");
  });
}

function trigrams(word: string): Set<string> {
  const padded = `  ${word} `;
  const out = new Set<string>();
  for (let i = 0; i + 3 <= padded.length; i++) out.add(padded.slice(i, i + 3));
  return out;
}

/** How much of the query word's trigrams one word of the text shares (0 to 1). */
function nearness(alt: string, words: string[]): number {
  const want = trigrams(alt);
  let best = 0;
  for (const word of words) {
    const have = trigrams(word);
    let common = 0;
    for (const t of want) if (have.has(t)) common++;
    best = Math.max(best, common / want.size);
  }
  return best;
}

/**
 * 0 to 1: the share of query groups the text matches. A word starting with an
 * alternative counts fully; with fuzzy on, a near spelling counts partly (as
 * in the database). Keep fuzzy off for long text, where near spellings of
 * something are almost always present.
 */
export function matchScore(text: string, groups: string[], opts: { fuzzy?: boolean } = {}): number {
  if (!groups.length) return 0;
  const norm = normalizeText(text);
  if (!norm) return 0;
  const padded = ` ${norm}`;
  const words = opts.fuzzy ? norm.split(" ") : [];
  let sum = 0;
  for (const group of groups) {
    let best = 0;
    for (const alt of group.split("|")) {
      if (!alt) continue;
      if (padded.includes(` ${alt}`)) {
        best = 1;
        break;
      }
      if (opts.fuzzy) best = Math.max(best, nearness(alt, words));
    }
    sum += best;
  }
  return sum / groups.length;
}
