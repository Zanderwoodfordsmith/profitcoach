# The Profit Coach: site structure

The site has one job: move an owner from "that's me" to a BOSS Score, and from
the score to a strategy call. Every page earns its place by moving someone one
step along Mariska's journey:

Recognition → Curiosity → Diagnosis → Commercial realisation → Action → strategy
call → six-month programme.

## CTA hierarchy (same labels on every page)

| Level | Label | Where it appears |
|---|---|---|
| Primary | Get my free BOSS Score | Every page until someone has a score |
| Secondary | See how the Profit System works | Home, story, questions |
| Conversation | Book my strategy call | Only on the results page and the strategy call page, after a score exists |

Never use "Contact us", "Learn more" or "Book a call" as a primary action.

## Pages

```
/                       Home  (this build)
├── /score              BOSS Score landing       → /assessment (the 50 questions)
│     └── results       BOSS results (the sales page, one per owner)
│           └── /strategy-call   Strategy call  → six-month programme
├── /profit-system      The Profit System (programme page; today /how-it-works)
├── /our-story          Pam and Zander, the full story
├── /questions          Fair questions (objections, FAQ)
├── /coaches            Find a Profit Coach (today /directory)
│     └── /coaches/[name]   Coach profile, with their own score link
└── footer              Privacy · Terms · For coaches: Business Coach Academy
```

### `/` Home

The job is recognition, then the diagnostic. The order follows Mariska:
- successful but trapped
- the ledger ("which of these is your week?")
- the diagnostic (peak)
- five levels
- owner bottleneck
- the Profit System
- the maths
- the short founder story and coach collective
- questions
- the close

The founder story stays short here. It builds trust and links to `/our-story`.

### `/score` BOSS Score landing

- **Job:** turn curiosity into a started diagnostic.
- **Headline:** "Your business has a score. You just don't know it yet."
- **Facts:** 50 questions, 10 areas, about 10 minutes, scored out of 100, free.
- **What you get:** Score, Wheel, level, first 90 days.
- **Friction answers:** why it's free, what happens to your answers, how long
  it takes.
- **Proof:** one line of founder proof and the John Davy quote.
- **Not on this page:** navigation that competes with starting.

### Results (the sales page)

Mariska: treat it as a sales page, not a report. In order:
1. The score and level.
2. The wheel, with its three biggest gaps named in plain words.
3. What those gaps usually cost an owner in time and margin, told without
   invented benchmarks.
4. The first 90 days.
5. The conversation CTA: "Book my strategy call".
6. The strategy call price appears here, next to the call.

### `/strategy-call` Strategy call

- Copy: "This isn't a sales call. It's a working session around your BOSS
  Score."
- What you leave with: your biggest constraint, where profit is leaking, the
  first three moves, and whether the programme is a fit.
- Mariska's honesty line: if there's no meaningful value to add, we say so.
- The price is shown here and on results only.

### `/profit-system` The Profit System

- **Job:** answer "is this a system or just coaching?"
- **Content:**
  - three pillars (Vision, Velocity, Value) on the Owner Performance
    foundation
  - the nine areas that spell ADD PROFIT
  - the 50 playbooks by level
  - how the six months run
  - what a session looks like
- **Secondary audience:** owners who want proof of method before they take the
  score.
- Today's `/how-it-works` becomes this page. Keep a redirect.

### `/our-story` Our story

The long version from the Pam and Zander transcript:
- Pam starting at 17
- five businesses
- New Year's Day 2000
- paralysis, day ten, Zander at ten
- three years of recovery, eight hours a day of business books
- restarting £70,000 in debt
- within five years, rebuilding everything
- selling at 46
- Zander's line at eight: "Mum, I've spent too many years of my life in your
  business."
- "I wanted to be that coach I wish I'd had when I started my business when I
  was 17."
- It ends at the BOSS Score. It doesn't link to coaching.

Coaches appear here as the collective: one system, one score, 250+ trained.

### `/questions` Fair questions

- Mariska's six objections, each answered in two or three sentences.
- Practical questions: cost of the score (free), time, data privacy, what
  happens after, and UK-only or not.
- Each answer ends with the primary CTA.

### `/coaches` Find a Profit Coach

- For owners who want a person before a score.
- Every profile routes to that coach's own score link, so the diagnostic still
  comes first.
- Headline idea: "Every Profit Coach starts with your score."

## Pages that don't belong on this site

Anything aimed at people becoming coaches (licences, the academy, coach
income) lives on the BCA site. The Profit Coach footer carries one small link,
"For coaches: Business Coach Academy", and nothing more.

## Open items before launch

- Privacy and Terms pages don't exist yet as site pages. The footer links to
  `/privacy` and `/terms`.
- `/our-story`, `/questions`, `/strategy-call` and `/profit-system` are new
  routes.
- The homepage links are root-relative, so they resolve once the page lives
  inside the Next app. On the static preview they 404.
