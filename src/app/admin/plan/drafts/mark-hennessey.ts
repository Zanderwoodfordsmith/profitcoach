import { lnBold as b, type CoachDrafts } from "./types";

/**
 * Mark Hennessey, written 28 Oct from his Blueprint, his LinkedIn (13 Oct) and Pam's calls
 * (16, 21 and 27 Oct). Discreet: an industry expert, never a coach, never "book a call".
 * Pam is writing his by hand too, so Zander can compare.
 */
export const drafts: CoachDrafts = {
  slug: "mark-hennessey",
  name: "Mark Hennessey",
  positioning:
    "An engineering and electronic security operator who built three businesses from scratch and sold his stake in all three. Never called a coach.",
  market:
    "Owner-led UK engineering businesses: electrical and mechanical engineering, electronic security and specialist manufacturing, 11 to 50 staff, £1m to £10m. Not automation or large perimeter security firms (his employer's competitors), and nobody close to his employer.",
  proofUsed: [
    "Built three businesses from scratch and sold shares or full equity in all three (his Blueprint).",
    "Founded Autogate Systems and took it from start-up to a recognised market leader, then negotiated its sale to a corporate group (his LinkedIn).",
    "Kept that business alive when his investor died suddenly, by negotiating a way out with several creditors (his Blueprint story).",
    "As Technical Director at Hi Tec Controls (1991 to 2007), helped grow it from a sole trader into an established engineering company (his LinkedIn).",
    "In his service business, every £1 of preventative maintenance brought £3 to £4 back in repairs (Pam's call, 21 Oct).",
    "Engineers who joined him as apprentices at 15 are still with him at 28 (Pam's call, 21 Oct).",
  ],
  gaps: [
    {
      gap: "No result with a number and a timeframe he is happy to use. He told Pam he doesn't want figures on his profile.",
      ask: "For Autogate, roughly what were turnover and team size when you started and when you sold, and can those numbers go in private messages (never your profile)?",
    },
    {
      gap: "How big Hi Tec Controls got, and over how long.",
      ask: "When you left Hi Tec Controls in 2007, roughly how many staff and what turnover did it have?",
    },
    {
      gap: "Which market goes first. On 21 Oct Pam's chosen profile included automation and electronic security, his employer's world.",
      ask: "Are you comfortable messaging electronic security owners while you're at Autogate, or shall we start with electrical and mechanical engineering only?",
    },
    {
      gap: "His LinkedIn isn't connected to the app (only Outlook), so nothing can send yet. He has Premium with Sales Navigator, so notes are fine once it's connected.",
      ask: "Can you connect LinkedIn in Settings? It takes about 5 minutes.",
    },
    {
      gap: "The newsletter's name, for the profile and the last message. Pam is writing his first edition.",
      ask: "Pam: what is Mark's newsletter called, and when does the first edition go out?",
    },
    {
      gap: "A profile photo. Pam said the current one can't be used.",
      ask: "Can you send a head and shoulders photo with a plain background?",
    },
    {
      gap: "Profile changes shouldn't notify his network.",
      ask: "Before we change your profile, can you switch off 'Share profile updates with your network'? We'll show you where.",
    },
  ],
  linkedin: {
    headline: {
      now: "Managing Director at Autogate Systems Limited",
      draft:
        "Managing Director, Autogate Systems | 35 years in electrical and mechanical engineering and electronic security | Built three businesses from scratch",
      why: "Discreet rule: it says what he knows and what he has built, fits his current job, and has no money figures or advice offer for his employer to question.",
    },
    about: {
      now: "(empty)",
      draft:
        "I've spent 35 years in engineering and electronic security, and most of it running the business as well as the engineering.\n\nI started out as Technical Director at Hi Tec Controls, helping it grow from a sole trader into an established engineering company. Then I built Autogate Systems from nothing into a recognised market leader. Along the way my investor died suddenly, and I had to negotiate a way through with several creditors to keep the business alive. We came out of it stronger, and I later negotiated its sale to a corporate group.\n\nWhat I've learned about engineering businesses:\n\n- Being good at engineering and being good at business are two different skills.\n- Margin hides in the work you already do: service and maintenance contracts, and small product changes that give you something nobody else has.\n- A business that leans on one or two customers, or on its owner, is worth less than it should be.\n- Good decisions come from good information, not gut feel.\n\nI'm straight talking and I've been in your shoes. Some of the engineers who started with me as apprentices at 15 are still with me at 28, and that's what I'm proudest of.\n\nI write a short newsletter for owners of engineering businesses on what I've learned. Subscribe if it would be useful.",
      why: "Discreet rule: it shows he's been in the owner's shoes, names the pains Pam found (margins, sameness, reliance on the owner and a few customers), and ends with the newsletter, not a call.",
    },
    aboutStyled: [
      {
        label: "A: pain, result, then the 5 stages",
        draft: `Good engineers. A full order book. And the margin still isn't where it should be.

I built three engineering businesses and sold shares or the whole company in all three. Most owners I meet now face the problems I had:
• Every big decision still comes back to you.
• You win work on price, because nothing makes you different.
• One or two customers carry too much of the business.
• It couldn't run for a week without you, so it's worth less than it should be.

None of that is a failing. Being good at engineering and being good at business are two different skills, and nobody teaches the second one.

▶︎ ${b("WHAT I HELP OWNERS DO")}
Get more margin from the work they already win, and build a business that runs, and would sell, without them.

▶︎ ${b("WHAT I'VE DONE")}
• Technical Director at Hi Tec Controls, helping it grow from a sole trader into an established engineering company.
• Built Autogate Systems from nothing into a recognised market leader, then negotiated its sale to a corporate group.
• Kept that business alive when my investor died suddenly, by negotiating a way through with several creditors.
• In my service business, every £1 of preventative maintenance brought £3 to £4 back in repairs.

▶︎ ${b("THE FIVE STAGES I SEE")}
1. Overwhelmed: every day is a fire.
2. Overworked: it works, because you do.
3. Organised: systems and a team, but the hard calls still come back to you.
4. Overseer: the team carries the work and you run the business.
5. Owner: it runs without you, and it's worth more because of it.
Most owner-led engineering firms sit at 2 or 3. You find your stage, then fix the few things holding you there. You don't need a bigger team or an MBA to move up.

Some of the engineers who started with me as apprentices at 15 are still with me at 28. That's what I'm proudest of.

▶︎ I write a short newsletter for owners of engineering businesses. ${b("Subscribe")} in my Featured section, or take the free BOSS Score there to see which stage you're at.`,
        why: "Checked against Jon Street's buyer beliefs: \"I do that\" (the four pains), \"it wasn't my fault, because\" (engineering and business are different skills, his own line), a simple way of seeing it for curiosity, and \"anyone can do this\". Pain first, in the words Pam heard from him (margin, being the same as everyone, a few big customers, reliance on the owner), then what owners get and his proof. The stages come after, so \"2 or 3\" makes sense. No emojis (his voice), no coaching and no call (discreet rule).",
      },
      {
        label: "B: a mini pitch (Vision, Velocity, Value)",
        draft: `Good engineers. A full order book. And the business still can't run a week without you.

I've been there. 35 years in engineering and electronic security, most of it running the business as well as the engineering.

▶︎ ${b("THREE QUESTIONS I ASK OF ANY ENGINEERING BUSINESS")}
1. ${b("Vision")}: where is it going, and does the team know?
2. ${b("Velocity")}: is the work you win making the margin it should? Service and maintenance is where most of it hides. In my service business, every £1 of preventative maintenance brought £3 to £4 back in repairs.
3. ${b("Value")}: would it run, and sell, without you or your biggest customer?

▶︎ ${b("WHAT I'VE DONE")}
• Technical Director at Hi Tec Controls, helping it grow from a sole trader into an established engineering company.
• Built Autogate Systems from nothing into a recognised market leader, then negotiated its sale to a corporate group.
• Kept that business alive when my investor died suddenly, by negotiating a way through with several creditors.
• Built three businesses and sold shares or the whole company in all three.

I'm straight talking. Some of the engineers who started with me as apprentices at 15 are still with me at 28. That's what I'm proudest of.

▶︎ I write a short newsletter for owners of engineering businesses. ${b("Subscribe")} if it would help.`,
        why: "The three stages become three questions an operator would ask, so it reads as experience, not a coaching method. It's the shortest of the three.",
      },
    ],
    featured: {
      now: "(empty)",
      draft: `1. His newsletter, pinned first once Pam's first edition is out.
2. The free BOSS Score: https://www.theprofitcoach.com/score/mark-hennessey?utm_source=linkedin&utm_medium=profile&utm_campaign=featured
   Caption: "Free: which stage is your engineering business at? 13 quick questions."
3. A post: "Every £1 we put into preventative maintenance brought £3 to £4 back in repairs", the margin lesson owners can use straight away.`,
      why: "Newsletter first (discreet rule), then the BOSS Score the About points to, with a tagged link so profile visitors show as their own source. No advisory offer on show.",
    },
    experience: {
      now: "Managing Director, Autogate Systems Ltd (Jul 2026 to now): Founded and developed a specialist automation and electronic security business from start-up into a recognised market leader before successfully negotiating its acquisition.",
      draft:
        "Managing Director, Autogate Systems Ltd\n\nI founded Autogate Systems and grew it from a start-up into a recognised market leader in automation and electronic security, then negotiated its sale to a corporate group, where I now lead it.\n\nI look after the whole business: engineering, product development, sales, service and the team. I've developed products nobody else in the market has matched, and built a team of engineers, many of whom trained with us as apprentices.",
      why: "It keeps his current role front and centre for his employer, while showing a prospect he built and sold the business, which is the proof that matters.",
    },
    banner: {
      now: "(none)",
      draft: "Image: an engineering workshop or a site install. Line: \"Engineering and electronic security. Built from scratch.\"",
      why: "Pam asked for an engineering image so he looks like the right person at a glance; the line is true and fits his day job.",
    },
  },
  connection: {
    a: {
      draft:
        "Hi {{first_name}}, I see you run a UK engineering business. I built three engineering firms from scratch and sold my stake in all three. Is growing {{company}} a priority this year?",
      why: "Growth version: his own result plus a yes or no, 179 characters; proof notes get fewer accepts but more meetings (100k requests).",
    },
    b: {
      draft:
        "Hi {{first_name}}, I see you run a UK engineering business. I took one from start-up to market leader and through its sale. Could {{company}} grow without needing more of your time?",
      why: "Time version, for the test: \"the owner keeps everything moving\" is the pain Pam found, and too busy was the most common thing owners told us.",
    },
  },
  followUps: [
    {
      step: "Message 1",
      timing: "1 day after they accept",
      a: "Thanks for connecting, {{first_name}}.\n\nQuick one: is {{company}} growing as fast as you'd like this year?",
      b: "Thanks for connecting, {{first_name}}.\n\nQuick one: does {{company}} still need you for most decisions?",
      why: "Starbucks rule: one yes or no, about 100 characters. A matches the growth note, B the time note.",
    },
    {
      step: "Message 2",
      timing: "4 days later",
      a: "{{first_name}}, one thing I learned running an engineering service business:\n\nevery £1 we put into preventative maintenance brought £3 to £4 back in repairs.\n\nMost owners have a margin lever like that and never spot it, because they're busy keeping everything moving.\n\nWorth a look at yours?",
      b: "{{first_name}}, the thing that knocks most off an engineering firm's value when it sells: too much turnover from one or two customers.\n\nI learned that selling my own.\n\nIs {{company}} more spread out than that?",
      why: "A new angle with his own proof (message 2 gets the most replies); short lines, no emojis because Mark's voice never uses them.",
    },
    {
      step: "Message 3",
      timing: "5 days later",
      a: "No rush, {{first_name}}. I write a short newsletter for engineering owners on exactly this. Would you like it?",
      b: "No rush, {{first_name}}. Is now just a bad time? A yes or no is fine.",
      why: "A gives something useful with a yes or no and fits the discreet rule (newsletter, not a call); B is the plain close.",
    },
  ],
  openProfile: {
    draft:
      "{{first_name}}, you've built a solid engineering business… does it still need you for nearly everything?\n\nI've been there. I built three engineering and electronic security businesses from scratch and sold my stake in all three, one of them after my investor died suddenly and I had to talk our creditors round.\n\nTwo things I learned the hard way:\n\n1. Margin hides in work you already do, like service and maintenance contracts\n2. A business that leans on one or two customers, or on its owner, is worth less when you sell\n\nI share what I've learned with a few owners like you, and in a short newsletter for engineering owners.\n\nWould that be useful?",
    why: "Zander's ad structure (hook, two numbered lines, real proof, a yes or no) in Mark's voice: plain numbers instead of emojis, no exclamation marks, never \"coach\".",
  },
  unsure: [
    "Market: Pam's 21 Oct profile includes automation and electronic security, his employer's world. The drafts say \"engineering business\" so they fit either, but the list decides who gets them. Start with electrical and mechanical engineering only?",
    "Emojis: Mark's voice says never emojis or exclamation marks, so message 2 and the Open Profile message use plain numbers instead of your 1️⃣ and ✅ style. Keep it his way?",
    "Figures: he told Pam no figures on his profile, so the profile has none. Is the £1 to £3–4 maintenance ratio fine in private messages and a featured post?",
    "The Open Profile message says he works with \"a few owners like you\", which hints at the advisory side he isn't announcing yet. It's private, but in his small industry it could reach his employer. Keep or cut that line?",
  ],
};
