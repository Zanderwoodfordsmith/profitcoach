# Ideal Client Avatar — schema derived from the BCA corpus

Findings from 215 documents pulled from the Business Coach Academy shared drive (`.ica-research/docs/`, gitignored). This is the reference for the avatar step of [First Campaign Setup](./first-campaign-setup.md).

## The key finding: Profile and Avatar are two artifacts, not one

They are consistently different documents, and the Profile is generated **first**, with the Avatar derived from it.

| | Ideal Client **Profile** | Ideal Client **Avatar** |
|---|---|---|
| Answers | Which market do I target? | Who is the human inside it? |
| Contains | Industry, geography, revenue band, team size, decision-maker titles, exclusions, the coach's positioning against that market | Name, age, location, inner voice, a specific scene on a specific evening |
| Evidence | Only 5% of Profile-named docs have a `Demographics` section; 95% of Avatar-form docs do | |

Sections unique to Profiles: `WHO THIS IS NOT FOR`, `CORE POSITIONING STATEMENT`, `NICHE REFINEMENT`, `Annual Revenue Range`, `Team Size`.

47 coaches have both files. One Avatar carries a comment confirming the dependency: *"It factors in the amends from the ideal client profile."*

**Consequence for the wizard:** step 2 (choose ICP) is effectively the Profile, and step 3 produces the Avatar from it. Edits to the Profile should propagate downstream. Generate in that order, never the reverse.

Caveat: the filenames are unreliable. 60 of 118 Avatar-named files contain a Profile inside them, because the original ChatGPT workflow produced both stages in one conversation and whichever name the coach saved under became the filename. Classify by content, not filename.

## Where the documents came from

They are outputs of a BCA prompt asset named inside the docs — **"Ideal Client Profile - 25 Psychological Triggers"** — followed by a second pass the coaches call **"Bring It to Life."** Two stages, one conversation.

## Three template generations

| Generation | Count | Shape | Verdict |
|---|---|---|---|
| **A — 25 Psychological Triggers + Bring It to Life** | 82 | Verbatim ChatGPT transcript; `##` headings; 93–100% section consistency | Only generation with a stable field list. **Build the schema on this.** |
| **B — Numbered ICP** | 6 | `1. Target Market Snapshot`, `2. Ideal Decision Maker`, `3. Current Reality`… Clean deliverable, no chat debris | Newest. Best Profile format. |
| **C — Emoji/thematic Avatar** | 28 | `# 🌙 WHAT KEEPS THEM AWAKE AT NIGHT`, `# ⚠️ CORE FRUSTRATIONS`, `# 🧲 ONE-LINE HOOK` | Newest. Richest, includes messaging hooks and disqualifiers, but improvised per coach |

Recency is evidenced by folder placement: 80 of 82 Gen A docs sit outside the recent "Work with Pam" 1:1 folders, while all 6 Gen B and 22 of 28 Gen C docs sit inside them.

**Recommended approach:** take Gen A's stable schema as the base and layer Gen B and C's extra sections (messaging hooks, disqualifiers, one-line summary) on top. Gen C's expressiveness comes precisely from having no fixed schema, so it cannot be automated as-is.

## Canonical sections

Corpus-wide percentages understate the standardisation, because the corpus mixes three templates plus empty stubs and research notes. The number that matters is presence **within** the dominant template.

### Stage 1 — psychological triggers (always in this order)

`Dreams` · `Past Failures` · `Fears` · `Suspicions` · `Enemies` — each 96–100% present within Gen A.

### Stage 2 — the persona

| Section | Within Gen A |
|---|---|
| Persona headline | ~all complete blocks |
| Demographics | 95% |
| Specific Problem | 95% |
| Triggering Events | 93% |
| Reality | 92% |
| Internal Monologue | 96% |
| Goals | 97% |
| Challenges | 96% |
| Quote | 95% |
| Behaviour | 80% |
| Background | 60% |

`Background` and `Behaviour` are the two genuinely optional core members.

### Valuable sections from the newer generations

`WHAT KEEPS THEM AWAKE AT NIGHT`, `Core Pain Points`, `Desired Outcomes`, `Buying Triggers`, `WHAT WILL HOOK THEM (MESSAGING)`, `WHO THIS IS NOT FOR`, `ONE-LINE SUMMARY`, `Their Values (Non-Negotiable)`.

`WHO THIS IS NOT FOR` appears in only 3 documents but is strategically valuable — disqualifiers sharpen targeting more than another pain bullet does.

## Voice rules per section

The register shifts deliberately between sections, and getting this wrong is what makes generated avatars feel generic.

| Section | Voice | Form |
|---|---|---|
| Triggers (all five) | Third person, descriptive | 4–6 bullets, `Bold Label: explanatory sentence` |
| Specific Problem | **First person, quoted** (strongest form; ~half the corpus) | One paragraph |
| Triggering Events | Third person, past tense | Discrete incidents, not conditions |
| Background | Third person, past tense | 1–2 prose paragraphs |
| Reality | Third person, **present tense**, cinematic | A single scene, specific time of day, sensory detail, closing on a realisation |
| Internal Monologue | **First person**, quoted, unbroken | One paragraph, self-contradicting, ends in confusion |
| Goals | Third person, infinitive phrases | 4–6 bullets |
| Challenges | Third person, noun phrases | External/structural obstacles |
| Behaviour | Third person, present tense | Observable actions — this is the "where to reach them" section |
| Quote | **First person**, outward-facing | 2–3 sentences, ends on readiness to act |

Two distinctions worth enforcing in the generator:

- **Challenges vs Fears** — Challenges are external and structural, Fears are emotional.
- **Internal Monologue vs Quote** — the monologue is private and ends in confusion; the Quote is what they'd say to a coach and ends ready to act.

**Self-awareness ceiling.** One document carries a coach correction that generalises into a rule: *"Steve wouldn't say 'I can't keep leading like this', he wouldn't have that degree of self-awareness."* The monologue must be written at the persona's own level of insight, not the coach's.

## Heading normalisation

The same field is spelled many ways, with gendered pronouns baked into headings. Counts across the corpus:

- Problem: `Specific Problem He Is Trying to Solve:` (74) / `She Is` (24) / `Specific Problem:` (12)
- Reality: `His Reality:` (48) / `Their Reality:` (30) / `Her Reality:` (17) / `Current Reality` (18), plus suffixes like `His Reality: The Breaking Point`
- Triggers: `Triggering Events: When Something Has to Change` (72) / `Triggering Events:` (20)
- Behaviour: `Behavior:` (46) / `Behaviour:` (35) / `Behaviors:` (17) / `Behaviours:` (14)

The generator needs a `subjectPronoun` variable rather than fixed heading strings.

## Best exemplars

**`Paul-McC---Ideal-Client-Profile-and-Avatar---Automotive.md`** — the cleanest complete example. Both stages in one pass, all five triggers with labelled bullets, all eleven persona sections in canonical order, no duplicated revision blocks, and it demonstrates the register shifts correctly.

**`Joe-Jarrett---Ideal-Client-{Profile,Avatar}---B2B-SAAS.md`** — best newer-format pair, client-approved, showing the Profile/Avatar division of labour cleanly.

## Storage schema

```ts
/** A labelled bullet: "Bold Label: explanatory sentence" — the dominant list form. */
interface LabelledPoint {
  /** e.g. "Enhanced Profit Margins". Optional: ~1/3 of lists are unlabelled. */
  label?: string;
  text: string;
}

/** Stage 1: the "25 Psychological Triggers" block. Market-level, third person. */
interface PsychologicalTriggers {
  dreams: LabelledPoint[];
  pastFailures: LabelledPoint[];
  fears: LabelledPoint[];
  suspicions: LabelledPoint[];
  enemies: LabelledPoint[];
}

interface Demographics {
  /** Single number in Gen A ("48"); range in Gen B/C ("42-55"). Keep as string. */
  age: string;
  location: string;
  education: string;
  occupation: string;
  businessSize?: string;
  family?: string;
}

/** Stage 2: the "Bring It to Life" persona. */
interface AvatarPersona {
  headline: string;
  personaName: string;
  /** Selects "His Reality:" vs "Her Reality:" vs "Their Reality:". */
  subjectPronoun: "he" | "she" | "they";
  demographics: Demographics;
  specificProblem: { text: string; isQuoted: boolean };
  triggeringEvents: LabelledPoint[];
  background?: string;
  reality: { headingSuffix?: string; prose: string };
  internalMonologue: string;
  goals: LabelledPoint[];
  challenges: LabelledPoint[];
  behaviour?: LabelledPoint[];
  quote: string;
}

/** Stage 0 / Gen B: the market-level Ideal Client Profile. */
interface IdealClientProfile {
  targetMarket: {
    industry: string;
    industryExamples?: string[];
    geography: string;
    revenueRange: string;
    teamSize: string;
    businessStage?: string[];
  };
  decisionMaker: {
    roleTitles: string[];
    profile: string[];
    mindset?: string[];
  };
  currentReality: string[];
  corePainPoints: { theme?: string; points: LabelledPoint[] }[];
  /** Verbatim phrases they say out loud — highest value for outreach copy. */
  frustrationsTheySayOutLoud?: string[];
  whatKeepsThemAwakeAtNight?: string[];
  desiredOutcomes?: LabelledPoint[];
  values?: { theyValue: string[]; theyReject: string[] };
  buyingTriggers?: string[];
  notAFit?: string[];
  coachPositioning?: {
    positioningStatement: string;
    whyThisCoach: string[];
    messagingHooks: string[];
  };
  oneLineSummary?: string;
}

interface IdealClientAvatarDocument {
  id: string;
  coachName: string;
  industry: string;
  template: "classic-25-triggers" | "numbered-icp" | "thematic-avatar";
  profile?: IdealClientProfile;
  triggers?: PsychologicalTriggers;
  persona?: AvatarPersona;
  /** Seed input: the coach's one-line description of their target client. */
  sourceBrief?: string;
  zoomRecordingUrl?: string;
  createdAt: string;
  updatedAt: string;
  /** Coach revision requests, which drove real edits in ~1/3 of the corpus. */
  amendments?: { requestedAt: string; note: string }[];
}
```

Two deliberate decisions: `age` and all size fields are strings because Gen A writes `Age: 48` while Gen B/C writes `Age: 42–55`, and forcing a number loses the range; and `profile`, `triggers` and `persona` are all optional because real documents routinely have only one or two of the three.

## Importing the existing corpus

Three cleanup rules, all evidenced in the archive:

1. **Strip transcript scaffolding.** 37 files contain literal `You said:` / `ChatGPT said:` turns.
2. **Take the last occurrence of each section, not the first.** Many files contain a section two or three times — the pre-amendment version followed by the corrected one, with no marker between them. In `Michael-Douglas---Ideal-Client-Avatar---Accountancy-Firm.md`, `## Dreams:` appears twice with materially different content and only the second reflects the coach's corrections.
3. **Apply a minimum-content check.** Some files are placeholders — `James-Ahearne---Ideal-Client-Avatar.md` is a title line and nothing else.
